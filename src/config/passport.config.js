// const passports = require('passport')
const jwtStrategy = require('passport-jwt').Strategy
const localStrategy = require('passport-local').Strategy
const {ExtractJwt} = require('passport-jwt')
require('dotenv').config();
const {AdminUser, protectedAdmin} = require('../models')
const { Buffer } = require('node:buffer');
var uuid = require('uuid');
const uuidBuffer = require('uuid-buffer');
const {HttpError, HttpError404} = require('../utils/errors')
const jwt = require('jsonwebtoken')

const cookieExtractor = function(req) {
    let token = null;
    
    if (req && req.cookies){
        token = req.cookies['jwt'];
        
    } 
    return token;
};

async function passportConfig(passport){
    passport.use(new jwtStrategy({
        jwtFromRequest: cookieExtractor,
        secretOrKey: process.env.JWT_SECRET_KEY
    }, async (payload, done)=>{
        try {
            
            const id = Buffer.from(uuid.parse(payload.sub, Buffer.alloc(16)), Buffer.alloc(16))
            const user = await AdminUser.findOne({
                where:{userId: id},
                attributes: ['userId', 'userUUID', 'email', 'username', 'avatar_url', 'status', 'isActive'],
                include:[
                    {
                        model: protectedAdmin,
                        as: 'protectedAdmin',
                        attributes: ['isSuperAdmin'],
                    }]
            });
            if(user===null){
                return done(new HttpError(401, "Tài khoản không tồn tại"), false);
            }else{
                return done(null,user);
            }
        } catch (error) {
            done(new HttpError(500), false);
        }
    }
    ));
    passport.use(new localStrategy({
        usernameField: 'email',
    }, async (email, password, done)=>{
        try {
            const user = await AdminUser.findOne({
                where:{email: email},
                attributes: ['userId', 'userUUID', 'email', 'username', 'hashpassword'],
            });
            if(!user){
                return done(new HttpError(401, 'Tài khoản không tồn tại'), false);
            }else{
                const isAuth = await user.validatePassword(password);
                if(isAuth){
                    return done(null, user)
                }else{
                    return done(new HttpError(401, 'Sai mật khẩu'), false)
                }
            }
            
        } catch (error) {
            return done(new HttpError(500), false)
        }
        
    }))
}


module.exports = passportConfig