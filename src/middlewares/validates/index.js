const {
    validateParam, schemaValidates, validates
} = require('../../helpers/router.validate')

const {HttpError, HttpError404} = require('../../utils/errors')

const Joi = require('@hapi/joi');
module.exports.validateOneParam = (name)=>{
    return (req, res, next)=>{
        const errors = [];
        if(schemaValidates.hasOwnProperty(name) && req.params.hasOwnProperty(name)){
            const validate = {};
            validate[name]= req.params[name]
            validateParam(schemaValidates[name], validate, (error, value)=>{
                if(error){
                    errors.push(new Error())
                }else{
                    req.params[name] = value[name];
                }
            })
        }else{
            errors.push(new Error())
        }
        if(errors.length===0){
            return next()
        }else{
            return next(new HttpError(400));
        }
    }
}

module.exports.validateManyParam = (names)=>{
    return (req, res, next)=>{
        const obj ={} 
        const obj_validate = {};
        const err = [];
        names.forEach(element => {
            if(req.params.hasOwnProperty(element)){
                obj[element] = req.params[element];
                obj_validate[element] = validates[element];
            }else{
                err.push(new Error())
            }
        });
        
        const Schema = Joi.object().keys(obj_validate);
        validateParam(Schema, obj, (error, value)=>{
            if(error){
                err.push(new Error())
            }else{
                req.params = {...req.params, ...value}
            }
        })

        if(err.length===0){
            return next()
        }else{
            return next(new HttpError(400));
        }
        
    }
}

module.exports.validateOneBody = (name)=>{
    return (req, res, next)=>{
        const errors = [];
        if(schemaValidates.hasOwnProperty(name) && req.body.hasOwnProperty(name)){
            const validate = {};
            // Trích xuất kiểu cần validate có sẵn trong schema bằng name truyền vào
            validate[name] = req.body[name] 
            // Gọi hàm validate từ schema có sẵn và đối tượng cần validate
            validateParam(schemaValidates[name], validate, (error, value)=>{
                if(error){
                    errors.push(new Error())
                }else{
                    
                    req.body[name] =value[name];
                }
            })
        }else{
            errors.push(new Error())
        }
        if(errors.length===0){
            return next()
        }else{
            return next(new HttpError(400));
        }
    }
}

/**
 * 
 * @param {*} names mảng tên các đối tượng cần validate
 * @returns next() middleware
 */
module.exports.validateManyBody = (names)=>{
    return (req, res, next)=>{
        const obj ={} 
        const obj_validate = {};
        const err = [];
        // Duyệt hết mảng các đối tượng cần validate
        names.forEach(element => {
            if(req.body.hasOwnProperty(element)){
                // obj chứa key value đối tượng cần validate
                obj[element] = req.body[element];
                // obj chứa các mẫu validate có sẵn của đối tượng validate
                obj_validate[element] = validates[element];
            }else{
                err.push(new Error())
            }
        });
        // Tạo schema các đối tượng cần validate
        const Schema = Joi.object().keys(obj_validate);
        validateParam(Schema, obj, (error, value)=>{
            if(error){
                err.push(new Error())
            }else{
                req.body = {...req.body, ...value}
            }
        })

        if(err.length===0){
            return next()
        }else{
            return next(new HttpError(400));
        }
        
    }
}
