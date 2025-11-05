import { Sequelize, DataTypes } from 'sequelize';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists before instantiating SQLite database
const dataDir = path.join(__dirname, '..', '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

// Database configuration
const dbPath = path.join(dataDir, 'juvo.db');
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false, // Set to console.log for SQL queries
  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: true
  }
});

// User model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true
  },
  avatarUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  homeAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  workAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  profileCompleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  expertise: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  identityProof: {
    type: DataTypes.STRING,
    allowNull: true
  },
  accountType: {
    type: DataTypes.ENUM('member', 'helper', 'chef'),
    defaultValue: 'member',
    allowNull: false
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  refreshTokens: {
    type: DataTypes.JSON,
    defaultValue: []
  }
}, {
  tableName: 'users'
});

// Service model
const Service = sequelize.define('Service', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price_cents: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  providerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  }
}, {
  tableName: 'services'
});

// Booking model
const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  serviceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'services',
      key: 'id'
    }
  },
  customServiceTitle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  customServiceDescription: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  memberId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  helperId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  offeredPrice_cents: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  counterOffer_cents: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  agreedPrice_cents: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  scheduled_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'counter_offered', 'accepted', 'paid', 'in_progress', 'completed', 'cancelled'),
    defaultValue: 'pending'
  }
}, {
  tableName: 'bookings'
});

// Payment model
const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bookingId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bookings',
      key: 'id'
    }
  },
  amount_cents: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  provider: {
    type: DataTypes.STRING,
    defaultValue: 'stripe'
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'failed'),
    defaultValue: 'pending'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'payments'
});

// Contact model
const Contact = sequelize.define('Contact', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  reason: {
    type: DataTypes.ENUM('elder', 'errand', 'apply', 'chef', 'other'),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('new', 'read', 'replied', 'closed'),
    defaultValue: 'new',
    allowNull: false
  }
}, {
  tableName: 'contacts'
});

// Schedule model for worker availability
const Schedule = sequelize.define('Schedule', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  workerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  bookingId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bookings',
      key: 'id'
    }
  }
}, {
  tableName: 'schedules'
});

// Earnings model for worker payouts
const Earnings = sequelize.define('Earnings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  workerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  bookingId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'bookings',
      key: 'id'
    }
  },
  amount_cents: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'cancelled'),
    defaultValue: 'pending',
    allowNull: false
  },
  payoutDate: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'earnings'
});

// Define associations
User.hasMany(Service, { foreignKey: 'providerId', as: 'services' });
Service.belongsTo(User, { foreignKey: 'providerId', as: 'provider' });

User.hasMany(Booking, { foreignKey: 'memberId', as: 'memberBookings' });
User.hasMany(Booking, { foreignKey: 'helperId', as: 'helperBookings' });
Booking.belongsTo(User, { foreignKey: 'memberId', as: 'member' });
Booking.belongsTo(User, { foreignKey: 'helperId', as: 'helper' });
Booking.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });
Service.hasMany(Booking, { foreignKey: 'serviceId', as: 'bookings' });

Booking.hasMany(Payment, { foreignKey: 'bookingId', as: 'payments' });
Payment.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

// Schedule associations
User.hasMany(Schedule, { foreignKey: 'workerId', as: 'schedules' });
Schedule.belongsTo(User, { foreignKey: 'workerId', as: 'worker' });
Schedule.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

// Earnings associations
User.hasMany(Earnings, { foreignKey: 'workerId', as: 'earnings' });
Earnings.belongsTo(User, { foreignKey: 'workerId', as: 'worker' });
Earnings.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

let connected = false;

/**
 * Initialize database connection and sync models
 */
export async function initDB() {
  if (connected) return;
  
  try {
    await sequelize.authenticate();
    console.log('SQLite database connection established successfully.');
    
  // Sync all models (create tables if they don't exist)
  await sequelize.sync({ force: false });
  await ensureUserSchema();
  console.log('Database synchronized successfully.');
    
    connected = true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDB() {
  if (connected) {
    await sequelize.close();
    connected = false;
    console.log('Database connection closed.');
  }
}

/**
 * Ensure indexes are created (Sequelize handles this automatically)
 */
export async function ensureIndexes() {
  // Sequelize automatically creates indexes based on model definitions
  // No additional action needed
}

async function ensureUserSchema() {
  try {
    const qi = sequelize.getQueryInterface();
    const table = await qi.describeTable('users');
    if (table && !table.refreshTokens) {
      await qi.addColumn('users', 'refreshTokens', {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
      });
      console.log('Added missing refreshTokens column to users table.');
    }
    if (table && !table.homeAddress) {
      await qi.addColumn('users', 'homeAddress', {
        type: DataTypes.TEXT,
        allowNull: true
      });
      console.log('Added missing homeAddress column to users table.');
    }
    if (table && !table.workAddress) {
      await qi.addColumn('users', 'workAddress', {
        type: DataTypes.TEXT,
        allowNull: true
      });
      console.log('Added missing workAddress column to users table.');
    }
  } catch (error) {
    // Most likely the table does not exist yet — sync will create it on first run
    if (error && error.name !== 'SequelizeDatabaseError') {
      console.warn('ensureUserSchema warning:', error.message || error);
    }
  }
  
  // Ensure Payment table has transactionId column
  try {
    const qi = sequelize.getQueryInterface();
    const paymentTable = await qi.describeTable('payments');
    if (paymentTable && !paymentTable.transactionId) {
      await qi.addColumn('payments', 'transactionId', {
        type: DataTypes.STRING,
        allowNull: true
      });
      console.log('Added missing transactionId column to payments table.');
    }
  } catch (error) {
    if (error && error.name !== 'SequelizeDatabaseError') {
      console.warn('ensurePaymentSchema warning:', error.message || error);
    }
  }
}

export { sequelize, User, Service, Booking, Payment, Contact, Schedule, Earnings };
export default { initDB, closeDB, ensureIndexes, sequelize, User, Service, Booking, Payment, Contact, Schedule, Earnings };