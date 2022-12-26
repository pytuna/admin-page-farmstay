// app.get('/', (req, res, next) => {
//   res.locals.noRenderHeader = true
//   res.render('home')
// });



// app.post('/', (req, res, next) => {
//   if(req.body.password == '123'){
//     next(new HttpError404())
//   }else{
//     res.json(req.body)
//   }
  
// });
const {HttpError, HttpError404,HttpError401, HttpError409} = require('../../utils/errors')
const jwt = require('jsonwebtoken')

function handleJWT(err, req, res, next){
  if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.NotBeforeError){
    next(new HttpError401())
  }
  next(err);
}

function handleHttpError401(err, req, res, next){
  if(err instanceof HttpError401 || err.statusCode ==401){
    req.flash('error_msg', err.messageResponse)
    res.status(302).redirect('/auth/login')
    return;
  }
  return next(err);
}

function handleHttpError409(err, req, res, next){
  if(err instanceof HttpError409 || err.statusCode ==409){
    req.flash('error_msg', err.messageResponse)
    res.status(302).redirect('/auth/register')
    return;
  }
  return next(err);
}


function handleHttpErrorDefault(err, req, res, next){
    if(err instanceof HttpError){
      res.locals.noRenderHeader = true
      res.status(err.statusCode).render(`pages/errors/${err.statusCode+'_'+err.nameError}`,);
      return;
    }else{
      res.status(500).json("err")
      return;
    }
    
}

const listArrayHandleError = [handleJWT,handleHttpError401, handleHttpError409, handleHttpErrorDefault, ];
module.exports = listArrayHandleError
