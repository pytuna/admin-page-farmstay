const multer = require("multer");
const mkdirp = require('mkdirp');

// type là tên body request tải lên
function uploadImage(type = '', imageName = ''){

    const made = mkdirp.sync(`./src/public/uploads/${type}`)

    // const storage = multer.diskStorage({
    //     destination: function(req, file, cb){
    //         cb(null, `./src/public/uploads/${type}`)
    //     },
    //     filename: function(req, file, cb){
    //         const uniqueSuffix = Date.now() + '-' + imageName
    //         const path = uniqueSuffix+'-'+file.fieldname+'.'+file.originalname.split('.').at(-1)
    //         cb(null,  path)
    //     }
    // })

    // lưu vào memoryStorage
    const storage = multer.memoryStorage()
    
    // lọc file ảnh
    const fileFilter = function(req, file, cb){
        const extFiles = ['.png', '.jpg']
        const ext = "."+file.originalname.split('.').at(-1);
        
        if(extFiles.includes(ext)){
            cb(null, true)
        }else{
            cb(new multer.MulterError(1611, "LỖI FILE KHÔNG HỢP LỆ"))
        }
    }
    
    const upload_Image = multer({storage: storage, fileFilter: fileFilter, limits: {fileSize: 5000000}})
    // trả về middleware tải ảnh lên
    return upload_Image.single(type)
}


module.exports = {
    uploadImage, 
}