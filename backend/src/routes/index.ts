import { Router } from "express";
import { cloudAccountRouter } from "./cloudAccountRoutes";
import { proposalRouter } from "./proposalRoutes";
import { scanRouter } from "./scanRoutes";

const apiRouter = Router();

apiRouter.use("/cloud-accounts", cloudAccountRouter);
apiRouter.use("/proposals", proposalRouter);
apiRouter.use("/scans", scanRouter);

export { apiRouter };
