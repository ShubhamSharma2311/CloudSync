import { Router } from "express";
import { cloudAccountRouter } from "./cloudAccountRoutes";
import { scanRouter } from "./scanRoutes";

const apiRouter = Router();

apiRouter.use("/cloud-accounts", cloudAccountRouter);
apiRouter.use("/scans", scanRouter);

export { apiRouter };
