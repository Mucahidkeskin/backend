import dotenv from "dotenv";

dotenv.config();

export default {
  DB_NAME: process.env.DB_NAME,
  DB_USERNAME: process.env.DB_USERNAME,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_HOST: process.env.DB_HOST,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  SENDGRID_KEY: process.env.SENDGRID_KEY,
  OPENAI_SECRET_KEY: process.env.OPENAI_SECRET_KEY,
  OPENAI_ORGANIZATION_ID: process.env.OPENAI_ORGANIZATION_ID,
  FRONTEND_URL: process.env.FRONTEND_URL,
};
