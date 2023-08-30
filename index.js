const express = require('express');
const {google}=require("googleapis");

const app=express()
const bodyParser=require("body-parser");
const cors=require("cors");
const {driveRouter}=require("./Router/driveRoute");
const {riskRouter}=require("./Router/riskRoute");
const{connection}=require("./config/db")



require("dotenv").config()

app.use(cors())
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());
app.use(driveRouter);
app.use(riskRouter);

app.get("/",(req,res)=>{
    res.send("Home-Page")
})






/* -------------------------- Don't touch below code ------------------ */
const port=process.env.PORT||5000
app.listen(port,async()=>{
    try{
        await app
        console.log(`Server running in port ${port}`)
    }
    catch(err){
        console.log(err.message)
    }
   
})