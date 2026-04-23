import { Router } from "express";
import { cloudAccountRouter } from "./cloudAccountRoutes";

const apiRouter = Router();

apiRouter.use("/cloud-accounts", cloudAccountRouter);

export { apiRouter };
