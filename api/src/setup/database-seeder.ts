import * as dotenv from 'dotenv';
dotenv.config();
import { CollectionNames } from '../database/constants';
import { MongoDbService } from '../services/mongodb-service';

export class DatabaseSeeder {
	constructor(private readonly url: string, private readonly dbName: string) {}
	async seed() {
		const expireAfterSeconds = 55;
		await MongoDbService.connect(this.url, this.dbName);
		const concurrencyCollection = MongoDbService.db.collection(CollectionNames.concurrencyLocks);

		const indexExists = await concurrencyCollection.indexExists('created_1');
		if (indexExists) {
			await concurrencyCollection.dropIndex('created_1');
		}
		await concurrencyCollection.createIndex({ created: 1 }, { expireAfterSeconds });
		await MongoDbService.disconnect();
	}
}

const config = {
	databaseUrl: process.env.DATABASE_URL,
	databaseName: process.env.DATABASE_NAME
};
const dbSeeder = new DatabaseSeeder(config.databaseUrl, config.databaseName);
dbSeeder.seed();
