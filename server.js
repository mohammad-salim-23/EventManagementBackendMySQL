
import express from 'express';
import cors from 'cors';
import userRoutes from './project/routes/user.js';
import eventRoutes from './project/routes/event.js';


const app = express();
app.use(express.json());
const PORT = process.env.PORT || 4000;
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true, 
}));

app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
 
// test home route
app.get("/", (req, res) => {
  res.send("API Server is running ");
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});