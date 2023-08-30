const express=require("express");
const {google}=require("googleapis");
const fs=require("fs");
const formidable=require("formidable")
const axios = require("axios");
const driveRouter=express.Router();
const credentials=require("../credentials.json")
const connectDB = require("../config/db"); // Import the MongoDB connection
const Token= require("../models/tokenModel"); 

connectDB()


const client_id=credentials.web.client_id;
const client_secret=credentials.web.client_secret;
const redirect_uris=credentials.web.redirect_uris;
const oAuth2Client=new google.auth.OAuth2(client_id,client_secret,redirect_uris[0])


const SCOPE = ['https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.file']

require("dotenv").config()


driveRouter.get("/getAuthURL",(req,res)=>{
    const authURL=oAuth2Client.generateAuthUrl({
        access_type:'offline',
        scope:SCOPE,
    })
    res.send(authURL)
    console.log(authURL)
    return(authURL)
})



driveRouter.post('/getToken', async (req, res) => {
    if (req.body.code == null) return res.status(400).send('Invalid Request');

    try {
        const { tokens } = await oAuth2Client.getToken(req.body.code);
        
        // Save the tokens to the MongoDB collection
        const tokenDocument = new Token({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            scope: tokens.scope,
            token_type:tokens.token_type,
            id_token: tokens.id_token,
            expiry_date: tokens.expiry_date,
        });
        await tokenDocument.save();

        res.send(tokens);
    } catch (err) {
        console.error('Error retrieving/accessing tokens', err);
        res.status(400).send('Error retrieving/accessing tokens');
    }
});




driveRouter.post('/getUserInfo', async (req, res) => {
    if (!req.body.access_token) return res.status(400).send('Access token not found');

    try {
        const access_token = req.body.access_token;
        const tokenDocument = await Token.findOne({ access_token });

        if (!tokenDocument) return res.status(400).send('Token not found in the database');

        oAuth2Client.setCredentials({
            access_token: tokenDocument.access_token,
            refresh_token: tokenDocument.refresh_token,
            scope: tokenDocument.scope,
            token_type: tokenDocument.token_type,
            id_token: tokenDocument.id_token,
            expiry_date: tokenDocument.expiry_date,
        });

        const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
        oauth2.userinfo.get((err, response) => {
            if (err) {
                console.error('Error getting user information', err);
                res.status(400).send(err);
            } else {
                console.log(response.data);
                res.send(response.data);
            }
        });
    } catch (err) {
        console.error('Error retrieving token from database or fetching user info', err);
        res.status(500).send('Internal Server Error');
    }
});


driveRouter.post('/readDrive', async (req, res) => {
    if (!req.body.access_token) return res.status(400).send('Access token not found');

    try {
        const access_token = req.body.access_token;
        const tokenDocument = await Token.findOne({ access_token });

        if (!tokenDocument) return res.status(400).send('Token not found in the database');

        oAuth2Client.setCredentials({
            access_token: tokenDocument.access_token,
            refresh_token: tokenDocument.refresh_token,
            scope: tokenDocument.scope,
            token_type: tokenDocument.token_type,
            id_token: tokenDocument.id_token,
            expiry_date: tokenDocument.expiry_date,
        });

        const drive = google.drive({ version: 'v3', auth: oAuth2Client });
        drive.files.list({
            pageSize: 10,
        }, (err, response) => {
            if (err) {
                console.log('The API returned an error: ' + err);
                return res.status(400).send(err);
            }
            const files = response.data.files;
            if (files.length) {
                console.log('Files:');
                files.map((file) => {
                    console.log(`${file.name} (${file.id})`);
                });
            } else {
                console.log('No files found.');
            }
            res.send(files);
        });
    } catch (err) {
        console.error('Error retrieving token from database or reading files from Google Drive', err);
        res.status(500).send('Internal Server Error');
    }
});



driveRouter.post('/fileUpload', async (req, res) => {
    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(400).send(err);

        const access_token = fields.access_token;
        if (!access_token) return res.status(400).send('Access token not found');

        try {
            const tokenDocument = await Token.findOne({ access_token });

            if (!tokenDocument) return res.status(400).send('Token not found in the database');

            oAuth2Client.setCredentials({
                access_token: tokenDocument.access_token,
                refresh_token: tokenDocument.refresh_token,
                scope: tokenDocument.scope,
                token_type: tokenDocument.token_type,
                id_token: tokenDocument.id_token,
                expiry_date: tokenDocument.expiry_date,
            });

            const drive = google.drive({ version: "v3", auth: oAuth2Client });

            const uploadedFile = files[''][0]; // Assuming 'files' is the field name in your form

            if (!uploadedFile) {
                return res.status(400).send('File not found');
            }

            const fileMetadata = {
                name: uploadedFile.originalFilename,
            };

            const media = {
                mimeType: uploadedFile.mimetype,
                body: fs.createReadStream(uploadedFile.filepath), // Corrected 'uploadedFile.filepath'
            };

            drive.files.create(
                {
                    resource: fileMetadata,
                    media: media,
                    fields: "id",
                },
                (err, file) => {
                    oAuth2Client.setCredentials(null);
                    if (err) {
                        console.error(err);
                        res.status(400).send(err);
                    } else {
                        res.send('Successful');
                    }
                }
            );
        } catch (err) {
            console.error('Error retrieving token from database or uploading file to Google Drive', err);
            res.status(500).send('Internal Server Error');
        }
    });
});


driveRouter.post('/revokeAccess', async (req, res) => {
    if (req.body.access_token == null) {
        return res.status(400).send('Token not found');
    }

    const access_token = req.body.access_token;
    if (access_token == null) {
        return res.status(400).send('Access token not found');
    }

    try {
        const tokenDocument = await Token.findOne({ access_token });

        if (!tokenDocument) {
            return res.status(400).send('Token not found in the database');
        }

        const revokeUrl = `https://accounts.google.com/o/oauth2/revoke?token=${access_token}`;

        // Send a request to Google's token revocation endpoint
        axios.get(revokeUrl)
            .then(async () => {
                // Remove the token from your database after revoking
                await Token.deleteOne({ access_token });
                res.send('Access revoked successfully');
            })
            .catch((error) => {
                console.error('Error revoking access:', error);
                res.status(500).send('Error revoking access');
            });
    } catch (err) {
        console.error('Error retrieving token from database', err);
        res.status(500).send('Internal Server Error');
    }
});

/* ------------------------------------------------ Export Code here------------------------------------- */
module.exports={
    driveRouter
}