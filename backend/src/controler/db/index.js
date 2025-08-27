import mongoose from "mongoose";
import { DB_NAME } from "../../constanats.js";


const connectDB = async () =>{
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
        console.log(`\n MongoDB Connected !! DB Host : ${connectionInstance.connection.host}`)
    } catch (error) {
        console.log("MongoDb Connection Failed:", error);
        process.exit(1);
        
    }
}

export default connectDB;