import 'dotenv/config';
import { DataSource } from 'typeorm';
import configuration from '../config/configuration';

const config = configuration();

export default new DataSource({
  type: 'postgres',
  host: config.db.host,
  port: config.db.port,
  username: config.db.user,
  password: config.db.password,
  database: config.db.name,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: config.db.sync,
  migrationsRun: config.db.migrationsRun
});
