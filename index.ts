import http from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import compression from 'compression'
import { Socket } from 'socket.io';
import MongoHelper from './helpers/mongo.helper';
import SocketLogic from './sockets/socket.logic';
import ENV from './environments/env';
import TokenHelper from './helpers/token.helper';
import bcrypt from 'bcryptjs';

const mongo = MongoHelper.getInstance(ENV.MONGODB);
const tokenHelper = TokenHelper(ENV, mongo);

(async() => {
    await mongo.connect(ENV.MONGODB.DATABASE);
    if (mongo.statusConnection.status == 'success') {
        console.log(`Conexión exitosa a MonngoDB en el puerto ${ENV.MONGODB.PORT}`);
        // Correr Express
        const app = express();
        app.use(express.json());
        app.use(compression());
        let whitelist = [
            'http://localhost:4200'
        ];
        app.use(cors({
          origin: (origin, callback) => {
            // allow requests with no origin
            if(!origin) return callback(null, true);
            if(whitelist.indexOf(origin) === -1) {
              var message = `The CORS policy for this origin doesn't allow access from the particular origin.`;
              return callback(new Error(message), false);
            }
            return callback(null, true);
          }
        }));
        //app.use(cors({origin: true, credentials: true}));

        app.get('/', (req: Request, res: Response) => {
            res.status(200).json({
                ok: true,
                msg: 'API Real-Time funcionando correctamente'
            });
        });

        app.post('/RegistrarEmail', async (req: Request, res: Response) => {
            const{ email,password, username, nombre, paterno, materno} = req.body;
            var salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync(password, salt);
            console.log(hash);
            console.log('Evaluar REQ.BODY =======>', email);
            const result = await mongo.db.collection('usuarios')
                .insertOne({
                    email:email,
                    password:hash,
                    nombre:nombre,
                    paterno: paterno,
                    materno: materno,
                    fullName: nombre+" "+paterno+" "+materno,
                    username:username,
                    isVerify:true,
                    role:"cliente",
                    photoUrl:"https://es.seaicons.com/wp-content/uploads/2016/11/Windows-Messenger-icon.png"
                })
                .then((result: any) =>{
                    return{
                        uid: result.insertedId,
                        rowsAffected: result.insertedCount
                    }
                })
                .catch((error: any) => console.log(error));
                res.status(201).json({
                    msg: "Registro exitoso",
                    user:email,
                    status:"OK"
                });
        })

        app.post('/loginOnEmail', async (req: Request, res: Response) => {
            const { email,password, apiKey } = req.body;

            console.log('Evaluar REQ.BODY =======>', email);

            const response: any = await mongo.db.collection('usuarios')
                .findOne(
                    { email, isVerify: true} ,
                    { projection: { _id: 0, email: 1, photoUrl: 1, fullName: 1}}
                )
                .then((result: any) => {

                    console.log('EVALUAR RESULT =====>', result); 

                    if (!result) {
                        return { 
                            ok: false, 
                            code: 404,
                            msg: `Lo sentimos, el usuario ${email} no se ha registrado aún o bien no ha habilitado su acceso`
                        }
                    }
                    return {
                        ok: true,
                        code: 200,
                        msg: `Inicio de sesión realizado de forma exitosa para el usuario ${email}`,
                        result
                    }
                })
                .catch((error: any) => {
                    return { 
                        ok: false,
                        code: 500, 
                        msg: `Ocurrio un error no contemplado al intentar inicar sesión con el usuario ${email}`,
                        error
                    }
                });


            console.log('ERROR LOGIN =========>', response);
            

            if (response.ok == false) {
                
                //Se comprueba contrasena
        if(bcrypt.compareSync(password,response.password)){


            res.status(200).json({
              status: "success",
              code: 200,
              msg: 'Inicio de sesión exitoso',
              info: response
          })  
          }else{
              res.status(401).json({
                  status: "No encontrado",
                  code: 401,
                  msg: 'Usuario o contrasena incorrectos'
              })
          }
                res.status(response.code).json(response);
            } else {
                // Solicitar Token para usuario
                const token: any = await tokenHelper.create(response.result, apiKey);                        
                res.status(response.code).json(token);
            }
        })

        app.post('/checkSocket', async (req:Request, res:Response) =>{
            const { email } = req.body;
            console.log('Evaluar SocketId de: =======>', email);

            const response: any = await mongo.db.collection('sockets')
                .remove(
                    { email } ,
                    { projection: { _id: 0, email: 1, socketId: 1}}
                )
                .then((result: any) => {

                    console.log('EVALUAR RESULT =====>', result); 

                    if (!result) {
                        return { 
                            ok: false, 
                            code: 404,
                            msg: `Lo sentimos, el usuario ${email} no se ha registrado aún o bien no ha habilitado su acceso`
                        }
                    }
                    return {
                        ok: true,
                        code: 200,
                        msg: `Se elimino el socket de la cuenta: ${email}`,
                        result
                    }
                })
                .catch((error: any) => {
                    return { 
                        ok: false,
                        code: 500, 
                        msg: `Ocurrio un error no contemplado al intentar eliminar el socket ${email}`,
                        error
                    }
                });

                console.log('ERROR LOGIN =========>', response);
            
            if (response.ok == false) {
                res.status(response.code).json(response);
            } else {
                res.status(response.code).json(response);
            }
        })

        app.post('/loginOAuth2', async (req: Request, res: Response) => {
            const { email, apiKey } = req.body;

            console.log('Evaluar REQ.BODY =======>', email);

            const response: any = await mongo.db.collection('usuarios')
                .findOne(
                    { email, isVerify: true} ,
                    { projection: { _id: 0, email: 1, photoUrl: 1, fullName: 1}}
                )
                .then((result: any) => {

                    console.log('EVALUAR RESULT =====>', result); 

                    if (!result) {
                        return { 
                            ok: false, 
                            code: 404,
                            msg: `Lo sentimos, el usuario ${email} no se ha registrado aún o bien no ha habilitado su acceso`
                        }
                    }
                    return {
                        ok: true,
                        code: 200,
                        msg: `Inicio de sesión realizado de forma exitosa para el usuario ${email}`,
                        result
                    }
                })
                .catch((error: any) => {
                    return { 
                        ok: false,
                        code: 500, 
                        msg: `Ocurrio un error no contemplado al intentar inicar sesión con el usuario ${email}`,
                        error
                    }
                });


            console.log('ERROR LOGIN =========>', response);
            
            if (response.ok == false) {
                res.status(response.code).json(response);
            } else {
                // Solicitar Token para usuario
                const token: any = await tokenHelper.create(response.result, apiKey);                        
                res.status(response.code).json(token);
            }
        })

        const httpServer = http.createServer(app);
        const socketIO = require('socket.io')(httpServer);

        // Funcionalidad Real-Time
        const socketLogic = SocketLogic(mongo);
        socketIO.on('connection', (socket: Socket) => {
            // TO DO: Lógica Real-Time
            console.log(`Nuevo cliente conectado con ID: ${socket.id}`);
            // Socket Connect
            socketLogic.listenSocketConnect(socket);
            // Logic SignUp
            socketLogic.signUp(socketIO, socket);
            // Logic Disconnect
            socketLogic.disconnect(socket,socketIO);
        });

        httpServer.listen(ENV.API.PORT, () => {
            console.log(`Servidor Express funcionando correctamente en puerto ${ENV.API.PORT}`);
        });

    } else {
        console.log('No se pudo establecer conexión co la base de datos');
    }
})();

// Handle Errors 
process.on('unhandleRejection', (error: any, promise) => {
    console.log(`Ocurrio un error no controlado de tipo promise rejection`, promise);
    console.log(`La descripción de error es la siguiente`, error);
    // Close MongoDB
    mongo.close();
    process.exit();
});
