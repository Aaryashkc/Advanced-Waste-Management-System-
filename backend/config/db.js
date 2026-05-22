import mongoose from 'mongoose';
import { logger, reportError } from '../utils/observability.js';

const connectDB = async()=>{
  try{
    const conn = await mongoose.connect(process.env.MONGO_URL);
    logger.info("MongoDB connected", { host: conn.connection.host });
    return conn;
  }catch(error){
    reportError(error, { source: "database", message: "MongoDB connection failed" });
    throw error;
  }
};

export default connectDB;
