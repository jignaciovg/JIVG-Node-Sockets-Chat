import { Socket } from "socket.io";
import TokenHelper from '../helpers/token.helper';
import ENV from '../environments/env';
import MongoHelper from '../helpers/mongo.helper';
import MongoDBHelper from "../helpers/mongo.helper";
import { verify } from "jsonwebtoken";
import bcrypt from 'bcryptjs';

let usersList: any[] = [];
const mongo = MongoDBHelper.getInstance(ENV.MONGODB);
const tokenHelper = TokenHelper(ENV,mongo);



export default (mongo: any) => {

    return {
        listenSocketConnect: async (socket: Socket) => {
            await mongo.db.collection('sockets')
                .insertOne({
                    socketId: socket.id,
                    usuario: null
                })
                .then((result: any) => console.log(result))
                .catch((error: any) => console.log(error));
        },
        
        signUp: (io: any, socket: Socket) => {
            socket.on('signUp', async (payload: any) => {
                // Guardar en Base de Datos
                await mongo.db.collection('sockets')
                    .findOneAndUpdate(
                        { socketId: socket.id },
                        { $set: { email: payload.email }}
                    )
                    .then((result: any) => console.log(result))
                    .catch((error: any) => console.log(error));

                await mongo.db.collection('usuarios').findOneAndUpdate(
                        { email: payload.email }, // Criterio de Busqueda
                        {
                            $setOnInsert: {
                                isVerify: true
                            },
                            $set: {
                                fullName: payload.fullName,
                                photoUrl: payload.photoUrl,
                                role:"cliente"
                            }
                        },
                        {
                            upsert: true
                        } 
                    )
                    .then(async (result: any) => {
                        console.log(result)
                        //CREACION DE TOKEN
                        const res:any = await tokenHelper.create(payload,payload.apiKey);
                        console.log("REVISION TOKEN",res);

                        //VERIFICAR TOKEN
                        if(res.ok){
                            console.log(await tokenHelper.verify(res.token,payload.apiKey));
                        }

                        //VERIFICAR EMAIL
                    })
                    .catch((error: any) => console.log(error));
                    
                
                usersList.push(payload)
                // Retransmitir la variable payload  a todos los clientes conectados
                io.emit('broadcast-message', usersList);
            });
        },
        disconnect: (socket: Socket, io:any) => {
            socket.on('disconnect', async (payload: any) => {
                console.log(`Desconexión del cliente con ID: ${payload.email}`);

                // Eliminar Socket Desconectado
                await mongo.db.collection('sockets')
                    .remove({email: payload.email})
                    .then((result: any) => {
                        console.log(result)
                    })
                    .catch((error: any) => console.log(error));

                    
                    usersList.splice(payload.email)
                    let index = usersList.findIndex(d => d.email === payload.email); //find index in your array
                    usersList.splice(index, 1);
                    io.emit('broadcast-message', usersList);
            });
        }
    }
};