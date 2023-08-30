// models/Token.js
const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
    access_token: String,
    refresh_token: String,
    scope: String,
    token_type: String,
    id_token: String,
    expiry_date: Number
});

const Token = mongoose.model('tokens', tokenSchema);

module.exports =Token;
