import { MongoClient, Db } from 'mongodb'
import { getInMemoryDB } from './db-fallback'

const USE_MONGODB = process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('localhost:27017')

if (!USE_MONGODB) {
  console.log('⚠️  Using in-memory database (fallback mode)')
  console.log('💡 For production, set MONGODB_URI in .env.local')
}

const uri = process.env.MONGODB_URI || ''
const options = {
  serverSelectionTimeoutMS: 10000,
}

let client: MongoClient | undefined
let clientPromise: Promise<MongoClient> | undefined

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

if (USE_MONGODB) {
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, options)
      global._mongoClientPromise = client.connect()
    }
    clientPromise = global._mongoClientPromise
  } else {
    client = new MongoClient(uri, options)
    clientPromise = client.connect()
  }
}

export async function getDatabase(): Promise<any> {
  if (!USE_MONGODB) {
    // 返回内存数据库的包装器
    const memDB = getInMemoryDB()
    return {
      collection: (name: string) => {
        if (name === 'users') {
          return {
            findOne: (query: any) => memDB.findUser(query),
            find: (query: any) => ({
              sort: () => ({
                toArray: () => memDB.findUsers(query)
              }),
              toArray: () => memDB.findUsers(query)
            }),
            insertOne: (doc: any) => memDB.insertUser(doc),
            updateOne: (query: any, update: any) => {
              const id = query._id
              return memDB.updateUser(id, update.$set)
            },
            deleteOne: (query: any) => memDB.deleteUser(query._id),
            deleteMany: () => Promise.resolve({ deletedCount: 0 }),
            insertMany: (docs: any[]) => {
              docs.forEach(doc => memDB.insertUser(doc))
              return Promise.resolve({ insertedCount: docs.length })
            }
          }
        } else if (name === 'leads') {
          return {
            findOne: (query: any) => memDB.findLead(query),
            find: (query: any) => ({
              sort: () => ({
                toArray: () => memDB.findLeads(query)
              }),
              toArray: () => memDB.findLeads(query)
            }),
            insertOne: (doc: any) => memDB.insertLead(doc),
            updateOne: (query: any, update: any) => {
              const id = query._id
              return memDB.updateLead(id, update.$set)
            },
            deleteOne: (query: any) => memDB.deleteLead(query._id),
            deleteMany: () => Promise.resolve({ deletedCount: 0 }),
            insertMany: (docs: any[]) => {
              docs.forEach(doc => memDB.insertLead(doc))
              return Promise.resolve({ insertedCount: docs.length })
            }
          }
        }
        return {}
      }
    }
  }

  if (!clientPromise) {
    throw new Error('MongoDB client not initialized')
  }

  try {
    const client = await clientPromise
    const db = client.db('fincrm')
    console.log('✅ Connected to MongoDB Atlas')
    return db
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    throw error
  }
}

export default clientPromise || Promise.resolve(null as any)
