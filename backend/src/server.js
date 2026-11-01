const express = require("express");
const cors = require("cors");
require("dotenv").config();

// this contains all the middleware 
const authMiddleware = require("./middleware/authMiddleware");

const app = express();

// this contains all the imported routes for this project
const githubRoutes = require("./routes/githubRoutes");
const repositoryRoute = require("./routes/repositoryRoute");


app.use(cors({
    origin: "http://localhost:5173"
}));

app.use(express.json());

app.use("/api/github", githubRoutes);
app.use("/api/repositories",repositoryRoute);


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