const express=require("express");
const {google}=require("googleapis");
const riskRouter=express.Router();


const credentials=require("../credentials.json")


const client_id=credentials.web.client_id;
const client_secret=credentials.web.client_secret;
const redirect_uris=credentials.web.redirect_uris;
const oAuth2Client=new google.auth.OAuth2(client_id,client_secret,redirect_uris[0])


const SCOPE = ['https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.file']

require("dotenv").config()

riskRouter.get('/auth/callback', async (req, res) => {
  try {
      const { access_token } = req.query;
      
      if (!access_token) {
          return res.status(400).json({ error: 'Access token missing' });
      }

      // Set the credentials using the provided access token
      oAuth2Client.setCredentials({ access_token });

      const drive = google.drive({ version: 'v3', auth: oAuth2Client });
      const response = await drive.files.list({
          pageSize: 10,
          fields: 'nextPageToken, files(id, name, mimeType, size, webContentLink)',
      });

      const files = response.data.files;

      const analytics = {
          fileTypes: {},
          totalSize: 0,
      };

      files.forEach(file => {
          const fileType = file.mimeType;
          const fileSize = parseInt(file.size);

          if (analytics.fileTypes[fileType]) {
              analytics.fileTypes[fileType]++;
          } else {
              analytics.fileTypes[fileType] = 1;
          }

          analytics.totalSize += fileSize;
      });

      // Calculate risk percentage based on data from the files (example: total file size)
      const totalFileRisk = analytics.totalSize * 0.01; // Assuming 1% of total size is risky

      const riskPercentage = (totalFileRisk / analytics.totalSize) * 100;

      console.log(files, analytics, riskPercentage)
      res.json({ files, analytics, riskPercentage });
  } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'An error occurred' });
  }
});

  module.exports={
    riskRouter
  }