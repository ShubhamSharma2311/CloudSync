import { Router } from "express";
import { listNotificationsController } from "../controllers/notificationController";
import { attachRequestContext } from "../utils/requestContext";

const notificationRouter = Router();

notificationRouter.get("/", attachRequestContext, listNotificationsController);

export { notificationRouter };
