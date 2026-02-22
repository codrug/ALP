import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'node-api', timestamp: new Date().toISOString() });
});

// Example API route
app.get('/api/example', (req: Request, res: Response) => {
    res.json({ message: 'Hello from Node.js backend!' });
});

app.listen(port, () => {
    console.log(`[server]: Node.js Server is running at http://localhost:${port}`);
});
