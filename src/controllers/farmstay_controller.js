const {HttpError, HttpError404, HttpError400}           = require('../utils/errors')
const { Province, District, Ward, 
    Equipment, sequelize, Farmstay, Employee,
    FarmstayEquipment, FarmstayAddress}                 = require('../models/mysql')
const {generateBufferUUIDV4, uuidToString}              = require('../helpers/generateUUID');
const { QueryTypes, Op , fn}                                = require('sequelize');
const slug                                              = require('slug')
const PromiseBlueBird                                   = require('bluebird');
const {arrayToJSON, objectToJSON}                       = require('../helpers/sequelize')
const {imagekit, ImageKit}                              = require('../utils/uploads/image/upload_to_imagekit');
class FarmstayController{

    async renderFarmstays(req, res, next){
        try {
            
            // let {_pagination:{limit, page}} = res.locals;
            // limit = limit ? parseInt(limit):5;
            // page  = page ? parseInt(page):1;

            const [farmstays, total_farmstay_deleted ] = await Promise.all([
                Farmstay.findAll({
                    attributes: ['id', 'name', 'uuid', 'rent_cost_per_day', 'updatedAt'],
                    include: [
                        {
                            model: Employee,
                            as: 'management_staff'
                        }
                    ],
                    // limit: limit,
                    // offset: limit*(page-1)
                }),
                // Farmstay.count(),
                Farmstay.count({
                    where: {
                        deletedAt: {
                            [Op.not]: null
                        }
                    },
                    paranoid: false
                })
            ])
            // Object.assign(res.locals._pagination, {
            //     totalData: total_farmstay,
            //     totalDataShowing: farmstays.length
            // })
            
            res.render('pages/farmstay/farmstays', {
                farmstays: arrayToJSON(farmstays),
                total_farmstay_deleted,
            })
            
        } catch (error) {
            console.log(error)
            next(new HttpError(500, "C?? l???i x???y ra"));

        }
    }

    async renderCreateFarmstay(req, res, next){
        try {

            const data = await Promise.all(
                [
                    Province.findAll({
                        attributes: ['code', 'full_name','name' ]
                    }),
                    Equipment.findAll(
                        {
                            attributes: ['id', 'name', 'quantity', 'images', [sequelize.literal('`quantity`-`total_used`'), 'remain']]
                        }
                    ),
                ]
            )
            let [provinces, equipments] = data
            provinces = provinces.map(v=>{
                return v.toJSON() 
            })
            equipments = equipments.map(v=>{
                return v.toJSON() 
            })
            // console.log(equipments)s
            const fakeManager = [
                {id: 1, 'name': "Trung Nam"},
                {id: 2, 'name': "Nam Anh"},
                {id: 3, 'name': "Ho??ng Ca"},
            ]
            res.status(200).render('pages/farmstay/create', {provinces, equipments, managers: fakeManager})

        } catch (error) {
            console.log(error)
            next(new HttpError(500, "C?? l???i x???y ra"));
        }
        
    }
    /**
     * [POST] T???o farmstay
     * @param {*} req 
     * @param {*} res 
     * @param {*} next 
     */
    async createFarmstay(req, res, next){
        
        let transaction;
        const images = [];
        try { 
            // L???y c??c th??ng tin client g???i l??n
            let {
                farmstay_name, //string 'Farmstay ...'
                rent_cost, // number vd. 1.000.000
                equipments:equipmentsStr, // array string vd. ["1-2","2-2","3-3","4-2", "5-3"]
                link_embedded_ggmap, // string
                link_ggmap, //string
                address, //string
                ward_code, //string vd. '09888'
                description, //string
                manager_id //number S
            } = req.body;
            rent_cost = parseInt(rent_cost)
            manager_id = parseInt(manager_id);

            transaction = await sequelize.transaction();
            // L???y to??n b??? file ???nh ???????c g???i l??n v?? l??u v??o th?? m???c uploads
            const {files} = req;
            
            const IMAGES = [] // m???ng ch???a buffer v?? ???????ng d???n file
            for (const element of files) {
                const {buffer, originalname, fieldname} = element;
                const uniqueSuffix = Date.now()+'_'+slug(farmstay_name, '_');
                const filename = uniqueSuffix+'-'+fieldname+'.'+originalname.split('.').at(-1)
                console.log(filename)
                IMAGES.push([buffer, filename])
            }
            // L??u c??c file ???nh
            const uploadImageResp = await PromiseBlueBird.map(IMAGES, async(image)=>{
                // return sharp(image[0]).toFile(`${pathDisk}/${image[1]}`);
                const [buffer, filename] = image;
                return imagekit.upload({
                    file : buffer, //required
                    fileName : filename,   //required
                    folder: 'Farmstay',
                    useUniqueFileName: true,
                })
            })
            
            uploadImageResp.forEach(v=>{
                const {url, fileId} = v;
                images.push({url, fileId});
            })
            
            // T??ch m???ng chu???i equipments l?? id v?? s??? l?????ng ['1-2', '2-3', ...]
            equipmentsStr = JSON.parse(equipmentsStr);
            let [equipments_id, equipments_quantity] = Array.from(equipmentsStr).reduce((array, value)=>{
                const arr = value.split('-');
                array[0].push(parseInt(arr[0])); // M???ng ch???a id
                array[1].push(parseInt(arr[1])); // M???ng ch???a s??? l?????ng c???a id
                return array;
            }, [[],[]]);

            const equipments = await Equipment.findAll({
                attributes: ['id', 'quantity', 'total_used'],
                where:{
                    id: equipments_id
                },
                transaction: transaction
            })

            const farmstay_equipments = [];
            equipments.forEach((element, index) => {
                const {quantity, total_used, id}= element;
                const farmstay_equipment = {}
                const index_equip = equipments_id.findIndex((value)=>{
                    return value==id
                })
                if(equipments_quantity[index_equip]>quantity-total_used){
                    throw new HttpError400('Kh??ng ????? s??? l?????ng')
                }else{
                    farmstay_equipment['equipment_id'] = id;
                    farmstay_equipment['quantity_used'] = equipments_quantity[index_equip];
                    equipments[index].total_used = total_used+equipments_quantity[index_equip];
                    farmstay_equipments.push(farmstay_equipment)
                }
            });
            
            // Obj farmstay c???n t???o
            const FARMSTAY_ATTRS = {
                uuid: generateBufferUUIDV4(),
                name: farmstay_name,
                rent_cost_per_day: rent_cost,
                manager_id: manager_id===0?null:manager_id,
                description: description,
                square_meter: 1000,
                address_of_farmstay: {
                    code_ward: ward_code,
                    specific_address: address,
                    link: link_ggmap,
                    embedded_link: link_embedded_ggmap
                },
                list_equipment: farmstay_equipments,
                images: images
            }
            await Promise.all(
                equipments.map(equipment=>equipment.save({transaction: transaction}))
            )
            //T???o farmstay
            await Farmstay.create(FARMSTAY_ATTRS, {
                include: [
                    {
                        model: FarmstayAddress,
                        as: 'address_of_farmstay'
                    },
                    {
                        model: FarmstayEquipment,
                        as: 'list_equipment'
                    }
                
                ],
                transaction: transaction
            });
            
            await transaction.commit();

            res.redirect('/farmstay');
        } catch (error) {
            console.log(error)
            if(transaction) {
                await transaction.rollback();
                await imagekit.bulkDeleteFiles(images.map(v=>v.fileId));

            }
            
            next(new HttpError(500, "C?? l???i x???y ra"));
        }
    }

    async renderTrashFarmstay(req, res, next){
        try {
            
            const [farmstays,] = await Promise.all([
                Farmstay.findAll({
                    attributes: ['id', 'name', 'uuid', 'rent_cost_per_day', 'deletedAt'],
                    include: [
                        {
                            model: Employee,
                            as: 'management_staff'
                        }
                    ],
                    where: {
                        deletedAt: {
                            [Op.not]: null
                        }
                    },
                    paranoid: false,
                }),
                
            ])
            res.status(200).render('pages/farmstay/trash', {
                farmstays: arrayToJSON(farmstays),

            })
        } catch (error) {
            console.log(error)
            next(new HttpError(500, "C?? l???i x???y ra"));
        }
    }
    /**
     * [DELETE] X??a m???m Farmstay s??? d???ng id
     */
    async deleteFarmstayById(req, res, next){
        try {
            const {farmstay_id} = req.query;
            await Farmstay.destroy({
                where: {
                    id: farmstay_id
                }
            })
            
            res.redirect('back') 
        } catch (error) {
            next(new HttpError(500, "C?? l???i x???y ra"));
            
        }
    }

    async restoreFarmstay(req, res, next){
        try {
            const {id} = req.body
            await Farmstay.restore({
                where:{
                    id: id
                }
            })
            res.redirect('/farmstay/trash')
        } catch (error) {
            next(new HttpError(500, "C?? l???i x???y ra"));
        }
    }

    async deleteForceFarmstay(req, res, next){
        try {
            const {farmstay_id:id} = req.query;
            const farmstay = await Farmstay.findOne({
                where:{
                    id
                },
                include: [
                    {
                        model: FarmstayEquipment,
                        as: 'list_equipment'
                    }
                ],
                paranoid: false
            })
            const {images} = farmstay;
            try {
                await imagekit.bulkDeleteFiles(images.map(v=>v.fileId));
            } catch (error) {
                console.log(error)
                
            }

            let {list_equipment} = objectToJSON(farmstay)
            // console.log(list_equipment)

            const data = list_equipment.reduce((prev, curr)=>{
                const {equipment_id, quantity_used} = curr;
                if(equipment_id){
                    prev.push({
                        equipment_id,
                        quantity_used
                    })
                    return prev;
                }
            }, [])
            console.log(data)
            await Promise.all(
                data.map(v=>{
                    const {equipment_id, quantity_used} = v;
                    console.log(v)
                    return Equipment.update({
                        total_used: sequelize.literal(`total_used-${quantity_used}`)
                    },{
                        where: {
                            id: parseInt(equipment_id)
                        }
                    })
                })
            )

            await Farmstay.destroy({
                where: {
                    id
                },
                force: true,
            })
            
            
            res.redirect('/farmstay/trash')
        } catch (error) {
            console.log(error)
            next(new HttpError(500, "C?? l???i x???y ra"));
            
        }
    }
    

    /**
     * [GET] Render Page Edit Farmstay
     */
    async renderEditFarmstay(req, res, next){
        try {
            const {id} = req.params;
            const farmstay = await Farmstay.findOne({
                where: {id},
                attributes: { exclude: ['createdAt', 'updatedAt', 'deletedAt', 'uuid', 'slug'] },
                include:[
                    {   
                        model: FarmstayAddress,
                        as: 'address_of_farmstay',
                        include:[{
                            model: Ward, as:'ward', attributes: ['code', 'name', 'full_name'], 
                            include: [{
                                model: District, as: 'district', attributes: ['code', 'name', 'full_name'],
                                include: [{model: Province, as: 'province', attributes: ['code', 'name', 'full_name'],}]
                            }]
                        }],

                    },
                    {
                        model: FarmstayEquipment,
                        as: 'list_equipment',
                        attributes: ['equipment_id', 'quantity_used'],
                        include: [
                            {
                                model: Equipment,
                                as: 'is_equipment',
                                attributes: ['id', 'name', 'quantity', 'images', 'deletedAt',[sequelize.literal('`quantity`-`total_used`'), 'remain']],
                                paranoid: false
                            }
                        ]
                    }
                ],
            });
            if(farmstay == null){
                return next(new HttpError400());
            }
            const provinces = await Province.findAll({
                attributes: ['code', 'name', 'full_name'],
            });
            
            const districts = await District.findAll({
                where: {province_code: farmstay.address_of_farmstay.ward.district.province.code},
                attributes: ['code', 'name', 'full_name'],
            });
            const wards = await Ward.findAll({
                where: {district_code: farmstay.address_of_farmstay.ward.district.code},
                attributes: ['code', 'name', 'full_name'],
            });
            const listIdEquipment = Array.from(farmstay.list_equipment).map(v=>v.is_equipment.id);
            const equipments = await Equipment.findAll(
                {
                    attributes: ['id', 'name', 'quantity', 'images', [sequelize.literal('`quantity`-`total_used`'), 'remain']],
                    where: {
                        id: {
                            [Op.notIn]: listIdEquipment
                        }
                    }
                }
            );
            // res.json(farmstay)
            res.render('pages/farmstay/edit', {
                farmstay: objectToJSON(farmstay),
                provinces: arrayToJSON(provinces),
                districts: arrayToJSON(districts),
                wards: arrayToJSON(wards),
                equipments: arrayToJSON(equipments),

            });
        } catch (error) {
            console.log(error);
            next(new HttpError(500, "C?? l???i x???y ra"));
        }
    }

    /**
     * [PUT] edit Farmstay
     */
    async editInfoFarmstay(req, res, next){
        try {
            const {id} = req.params;
            const {name, rent_cost} = req.body
            await Farmstay.update({
                    name: name,
                    rent_cost_per_day: rent_cost,
                },
                {
                    where: {id},
                }
            );
            res.redirect('back')
        } catch (error) {
            console.log(error);
            next(new HttpError(500, "C?? l???i x???y ra"));
        }
    }

    /**
     * [PUT] edit Farmstay
     */
    async editAddressFarmstay(req, res, next){
        try {
            const {id} = req.params;
            const {ward_code:code_ward,
                link_ggmap:link,
                link_embedded_ggmap:embedded_link,
                address: specific_address,
            } = req.body;
            await FarmstayAddress.update({code_ward, link, embedded_link, specific_address},{
                where: {
                    farm_id:id
                }
            });
            res.redirect('back')
        } catch (error) {
            console.log(error);
            next(new HttpError(500, "C?? l???i x???y ra"));
        }
    }

    /**
     * [PUT] edit Farmstay
     */
    async editImagesFarmstay(req, res, next){
        try {
            const {id} = req.params;
            const imagesBeforeAdd = [];
            let transaction;
            try {
                
                transaction = await sequelize.transaction();
                let {list_img_delete} = req.body;
                
                const farmstay = await Farmstay.findOne({
                    where: {id},
                    attributes: ['images', 'id', 'name'],
                    transaction
                })
                const {images} = farmstay;
                const {files} = req;
                const maxImage = 10
                if(Array.isArray(list_img_delete)&& ((images.length-list_img_delete.length)+files.length)>maxImage){
                    return next(new HttpError400);
                }
                
                if(files.length){
                    
                    const IMAGES = [] // m???ng ch???a buffer v?? ???????ng d???n file
                    for (const element of files) {
                        const {buffer, originalname, fieldname} = element;
                        const uniqueSuffix = Date.now()+'_'+slug(farmstay.name, '_');
                        const filename = uniqueSuffix+'-'+fieldname+'.'+originalname.split('.').at(-1)
                        IMAGES.push([buffer, filename])
                    }
                    // L??u c??c file ???nh
                    const uploadImageResp = await PromiseBlueBird.map(IMAGES, async(image)=>{
                        // return sharp(image[0]).toFile(`${pathDisk}/${image[1]}`);
                        const [buffer, filename] = image;
                        return imagekit.upload({
                            file : buffer, //required
                            fileName : filename,   //required
                            folder: 'Farmstay',
                            useUniqueFileName: true,
                        })
                    })
                    
                    uploadImageResp.forEach(v=>{
                        const {url, fileId} = v;
                        imagesBeforeAdd.push({url, fileId});
                    })
                    farmstay.addImageURL(imagesBeforeAdd);
                    
                }

                
                if(Array.isArray(list_img_delete)&&list_img_delete.length>0){
                    
                    const imagesDeleted = Array.from(farmstay.images).filter((value, index,)=>{
                        const {fileId} = value;
                        let id = list_img_delete.findIndex((value, index)=>{
                            return value === fileId;
                        })
                        return id===-1 
                    })
                    
                    if(imagesDeleted.length < farmstay.images.length){
                        
                        await imagekit.bulkDeleteFiles(list_img_delete);
                        farmstay.images = imagesDeleted;
                    }
                    
                }
                
                await farmstay.save({transaction});

                await transaction.commit();
                res.redirect('back')

            } catch (error) {
                if(transaction) {
                    await transaction.rollback();
                    await imagekit.bulkDeleteFiles(imagesBeforeAdd.map(v=>v.fileId));
                }
                throw error
            }
        } catch (error) {
            console.log(error);
            next(new HttpError(500, "C?? l???i x???y ra"));
        }
    }
    /**
     * [PUT] edit Farmstay
     */
    async editFarmstayEquipment(req, res, next){
        
        try {
            let transaction;
            const {id} = req.params;
            try {
                transaction = await sequelize.transaction();
                let {add_equipments, current_equipments} = req.body;

                // try {
                //     add_equipments = JSON.parse(add_equipments);
                //     current_equipments = JSON.parse(current_equipments);
                // } catch (error) {
                //     return next(new HttpError400());
                // }
                console.log(current_equipments)
                const [farmstayEquipments, equipments] = await Promise.all([
                    FarmstayEquipment.findAll({
                        where: {farm_id: id},
                        transaction
                    }),
                    Equipment.findAll({
                        attributes: ['id', 'quantity', 'total_used', [sequelize.literal('`quantity`-`total_used`'), 'remain']],
                        transaction
                    }),
                ]);
                    
                // array 
                const arrayIdEditFarmstayEquipment = [];
                const arrayIdEditEquipment = [];
                const arrayDeleteFarmstayEquipment = [];
                // Duy???t qua m???ng ch???a id v?? value equipment c???n s???a
                Array.from(current_equipments).forEach((value, index, array)=>{
                    const {id:idEditEquipment, value:valueEdit} = value;

                    // L???y ra id thi???t b??? hi???n t???i c???a farmstay
                    const indexFarmstayEquipment = farmstayEquipments.findIndex(value=>{
                        const {equipment_id} = value;
                        return equipment_id == idEditEquipment;
                    });
                    
                    // L???y ra index equipment c???n s???a hi???n t???i
                    const indexEquipment = Array.from(equipments).findIndex(v=>{
                        return idEditEquipment == v.id
                    })
                    // ki???m tra s??? l?????ng thu?? c???a farmstay hi???n t???i v???i gi?? tr??? s???a
                    const quantityEdit = -1*(farmstayEquipments[indexFarmstayEquipment]['quantity_used'] - valueEdit); 
                    
                    const checkEquipmentQuantity = (equipments[indexEquipment]['total_used']+quantityEdit)<=equipments[indexEquipment]['quantity'];
                    const checkFarmstayEquipment = (farmstayEquipments[indexFarmstayEquipment]['quantity_used']+quantityEdit) === 0;
                    if(checkEquipmentQuantity){
                        if(checkFarmstayEquipment){
                            arrayDeleteFarmstayEquipment.push(idEditEquipment);
                        }else{
                            farmstayEquipments[indexFarmstayEquipment]['quantity_used']+=quantityEdit;
                            arrayIdEditFarmstayEquipment.push(indexFarmstayEquipment);
                        }
                        
                        equipments[indexEquipment]['total_used']+=quantityEdit;
                        arrayIdEditEquipment.push(indexEquipment);
                    }
                })
                
                const arrayAddFarmstayEquipment = [];
                const arrayAddEquipment = [];
                Array.from(add_equipments).forEach((value)=>{
                    const {id:idAdd, value:valueAdd} = value;
                    const indexEquipment = Array.from(equipments).findIndex(v=>{
                        return idAdd == v.id
                    })
                    const checkEquipmentQuantity = (equipments[indexEquipment]['total_used']+parseInt(valueAdd))<=equipments[indexEquipment]['quantity'];
                    if(checkEquipmentQuantity){
                        equipments[indexEquipment]['total_used']+=parseInt(valueAdd);
                        arrayAddEquipment.push(indexEquipment);
                        arrayAddFarmstayEquipment.push({
                            farm_id: id,
                            equipment_id: idAdd,
                            quantity_used: valueAdd
                        })
                    }
                });
                await Promise.all([
                    PromiseBlueBird.map(arrayIdEditFarmstayEquipment, (item)=>{
                        return farmstayEquipments[item].save({transaction});
                    }),
                    PromiseBlueBird.map(arrayIdEditEquipment, (item)=>{
                        return equipments[item].save({transaction});
                    }),
                    FarmstayEquipment.destroy({
                        where: {
                            farm_id: id,
                            equipment_id: arrayDeleteFarmstayEquipment
                        },
                        transaction
                    }),
                    PromiseBlueBird.map(arrayAddEquipment, (item)=>{
                        return equipments[item].save({transaction});
                    }),
                    FarmstayEquipment.bulkCreate(arrayAddFarmstayEquipment, {transaction})

                ]);
                await transaction.commit();
                res.redirect('back')
            } catch (error) {
                if(transaction){
                    await transaction.rollback();
                }
                throw error
            }
        } catch (error) {
            console.log(error)
            next(new HttpError(500, "C?? l???i x???y ra"));
        }
        
    }


    /**
     * [API-GET] L???y to??n b??? t???nh
     * @param {*} req 
     * @param {*} res 
     * @param {*} next 
     */
    async getAllProvince(req, res, next){
        const provinces = await Province.findAll();
        res.json(provinces)
    }

    /**
     * [API-GET] L???y to??n b??? huy???n thu???c t???nh
     * @param {*} req 
     * @param {*} res 
     * @param {*} next 
     */
    async getAllDistrictOfProvince(req, res, next){
        const {province_code} = req.query;

        let districts = await District.findAll({
            where: {
                province_code: province_code
            },
            attributes: ['code', 'name', 'full_name']
        });
        districts = districts.map(v=>{
            return v.toJSON() 
        })
        res.json({districts})
    }

    /**
     * [API-GET] L???y to??n b??? x?? thu???c huy???n
     * @param {*} req 
     * @param {*} res 
     * @param {*} next 
     */
    async getAllWardOfDistrict(req, res, next){
        const {district_code} = req.query;

        let wards = await Ward.findAll({
            where: {
                district_code: district_code
            },
            attributes: ['code', 'name', 'full_name']
        });
        wards = wards.map(v=>{
            return v.toJSON() 
        })
        res.json({wards})
    }

}

module.exports = new FarmstayController()