import mongoose from 'mongoose';

const connectDB = async()=>{
  try{
    const conn = await mongoose.connect(process.env.MONGO_URL);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  }catch(error){
    console.error(`Erro database have some issues:`, error);
    throw error;
  }
};

export default connectDB;
