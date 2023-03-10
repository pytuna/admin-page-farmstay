const express                           = require('express');
const {sequelize}                       = require('./models/mysql');
const mongodb                           = require('./config/mongodb.config')
const morgan                            = require('morgan');
const {engine}                          = require('express-handlebars');
const cookieParser                      = require('cookie-parser');
const path                              = require('path');
const methodOverride                    = require('method-override');
const { createServer }                  = require('http');
const favicon                           = require('serve-favicon');

const ErrorMiddlewares                  = require('./middlewares/errors')
const router                            = require('./routers')
const {HttpError, 
    HttpError404}                       = require('./utils/errors')

const config                            = require('./config')
const Handlebar = require('handlebars')

const app = express();
const PORT = config.server.port;
Handlebar.registerHelper('ifEquals', function(arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

const main = async()=>{
    // Use middleware library
    app.use(morgan('dev'));
    
    app.use(express.urlencoded({extended: true,}));

    app.use(express.json());


    app.use(cookieParser(config.secret_key.cookie));

    app.use(methodOverride('_method'));

    app.use(express.static(path.join(__dirname, 'public')));
    
    app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))

    
    // Setup handlebars
    app.engine(
    '.hbs',
    engine({
        extname: '.hbs',
        encoding: 'utf-8',
        partialsDir: {
            dir: path.join(__dirname, 'resources', 'views', 'partials'),
        },
        layoutsDir: path.join(__dirname, 'resources', 'views', 'layouts'),
        helpers: {
            sum(a, b){
                return a+b
            },
            minus(a,b){
                return a-b;
            },
            compareString(a,b){
                
                return a+''.localeCompare(b+'')
            },
            page(page, limit_page, limit, max){
                let str = '';
                let n = Math.floor(page/limit_page);
                let from_page = limit_page*n+1;
                let to_page = limit_page*(n+1);
                
                if(page%limit_page==0 || (page%limit_page==1 && page!=1)){
                    from_page = page-1;
                    to_page = page+limit_page-2;
                };
                // console.log(max)
                
                if(to_page>Math.ceil(max/limit)){
                    to_page = Math.ceil(max/limit);
                }
                try {
                    for (let index = from_page; index <= to_page; index++) {
                        const href =  Handlebar.escapeExpression(
                            `?limit=${limit}&page=${index}`,
                        );
                        if(index==page){
                            str += `<li class="pagination-page active"><a href="${href}">${index}</a></li>`
                        }else{
                            str += `<li class="pagination-page"><a href="${href}">${index}</a></li>`
                        }
                    }
                    const output = str;
                    return new Handlebar.SafeString(output);

                } catch (error) {
                    console.log(error)
                }
                

            },
            prettifyDate:  function(timestamp) {
                function addZero(i) {
                    if (i < 10) {
                      i = "0" + i;
                    }
                    return i;
                }
    
                let curr_date = timestamp.getDate();
                let curr_month = timestamp.getMonth();
                curr_month++;
                let curr_year = timestamp.getFullYear();
    
                let curr_hour = timestamp.getHours();
                let curr_minutes = timestamp.getMinutes();
                let curr_seconds = timestamp.getSeconds();
    
                let result = addZero(curr_date)+ "/" + addZero(curr_month) + "/" + addZero(curr_year)+ '   ' +addZero(curr_hour)+':'+addZero(curr_minutes)+':'+addZero(curr_seconds);
                return result;
            },
            convertApiMethod(api_method){
                let num = parseInt(api_method)
                const methods = ["GET", "POST", "PUT", "DELETE"];
                let hasMethod = '';
                num = num.toString(2).split("").reverse().join("");
                
                for (let i = 0; i < num.length; i++) {
                    if(parseInt(num.charAt(i))===1){
                        hasMethod+=methods[i]+' ';
                    }
                }
                return hasMethod.trim();
            }
        }
    }),
    ); // c???u h??nh handlebars
    app.set('view engine', '.hbs');
    app.set('views', path.join(__dirname, 'resources', 'views'));

    
    // use router
    app.use(router);

    app.all('*', function(req, res, next){
        next(new HttpError404())
    });

    // use list error handle
    app.use(ErrorMiddlewares)

    try {
        await sequelize.authenticate();
        console.log("Connect MySql OK ^^");
        // require('./utils/create_super_admin')
    } catch (error) {
        console.log("Connect MySql FAIL :(");
    }
    // try {
    //     await mongodb.connect();
    //     console.log("Connect MongoDB OK ^^");
    // } catch (error) {
    //     console.log("Connect MongoDB FAIL :(");
    // }
    
    const httpServer = createServer(app)

    await new Promise(resolve =>httpServer.listen(PORT, '0.0.0.0', undefined, ()=>{
        console.log(`App listening on http://localhost:${PORT}`);
    }))
    
}

main().catch(error => console.log('ERROR STARTING SERVER: ', error))