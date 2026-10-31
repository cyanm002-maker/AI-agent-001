const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authMiddleware = require("./middleware/authMiddleware");

const app = express();

app.use(cors({
    origin: "http://localhost:5173"
}));

app.use(express.json());

// public api
app.get("/api/health",(req,res)=>{
    res.status(200).json({
        success:true,
        message:"project backend is running"
    });

})

// protected api 

app.get("/api/profile",authMiddleware,(req,res)=>{
    res.status(200).json({
        success:true,
        message:"You are authenticated",
        user:{
            id:req.user.id,
            email:req.user.email
        }
    });
});


app.get("/",(req,res)=>{
    res.json({
        message:"welcome to repo"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT,()=>{
    console.log(`Server running on port ${PORT}`)
})