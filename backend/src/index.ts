import express from "express";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./utils/errorHandler";

const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
	res.status(200).json({
		status: "ok",
		timestamp: new Date().toISOString(),
	});
});

app.use("/api/v1", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);

if (process.env.NODE_ENV !== "test") {
	app.listen(port, () => {
		console.log(`CloudSync backend running on port ${port}`);
	});
}

export { app };
