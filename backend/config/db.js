import mongoose from 'mongoose';

const connectDB = async()=>{
  try{
    const conn = await mongoose.connect(process.env.MONGO_URL);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  }catch(error){
    console.error(`Erro database have some issues:`, error);
  }
};

export default connectDB;