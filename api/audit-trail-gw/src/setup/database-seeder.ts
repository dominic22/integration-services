import { CollectionNames } from '../database/constants';
import { ILogger } from '@iota-is/shared-modules/lib/utils/logger';
import { MongoDbService } from '@iota-is/shared-modules/lib/services/mongodb-service';

const LOCK_EXPIRATION_TIME_SEC = 55;

export interface IDatabaseSeeder {
	seed(): void;
}

export class DatabaseSeeder {
	constructor(private readonly logger: ILogger) {}
	async seed() {
		const db = MongoDbService.db;
		const concurrencyCollection = db.collection(CollectionNames.concurrencyLocks);
		await concurrencyCollection.createIndex({ created: 1 }, { expireAfterSeconds: LOCK_EXPIRATION_TIME_SEC });

		const usersCollection = db.collection(CollectionNames.users);
		await usersCollection.createIndex({ username: 1 }, { unique: true, partialFilterExpression: { username: { $exists: true } } });
		this.logger.log('Database successfully seeded.');
	}
}
