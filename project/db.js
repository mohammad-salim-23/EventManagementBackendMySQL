import mysql from 'mysql2/promise';


//1. connect to mysql server
const pool = await mysql.createConnection({
    host:'localhost',
    user:'root',
    password:'root',
    database:"mysql_db"
});
console.log("Connected to MySQL server");

export default pool;