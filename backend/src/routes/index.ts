import { Router } from "express";
import { cloudAccountRouter } from "./cloudAccountRoutes";
import { proposalRouter } from "./proposalRoutes";
import { scanRouter } from "./scanRoutes";
import { resourceRouter } from "./resourceRoutes";

const apiRouter = Router();

apiRouter.use("/cloud-accounts", cloudAccountRouter);
apiRouter.use("/proposals", proposalRouter);
apiRouter.use("/scans", scanRouter);
apiRouter.use("/resources", resourceRouter);

export { apiRouter };
