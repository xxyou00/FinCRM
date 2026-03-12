// 内存数据库后备方案（用于开发/演示）
// 生产环境请使用真实的 MongoDB

interface User {
  _id: string
  email: string
  password: string
  firstName: string
  lastName: string
  company?: string
  role: string
  department: string
  status: string
  createdAt: Date
  updatedAt: Date
  lastLogin?: Date
}

interface Lead {
  _id: string
  name: string
  contact: string
  email: string
  phone: string
  source: string
  status: string
  priority: string
  value: number
  assignedTo: string
  notes: string
  createdAt: Date
  lastContact: Date
  updatedAt: Date
}

class InMemoryDB {
  private users: Map<string, User> = new Map()
  private leads: Map<string, Lead> = new Map()
  private userIdCounter = 1
  private leadIdCounter = 1

  constructor() {
    this.initializeData()
  }

  private initializeData() {
    // 初始化管理员用户（密码已经是 bcrypt 哈希后的 "admin123"）
    const adminId = String(this.userIdCounter++)
    this.users.set(adminId, {
      _id: adminId,
      email: 'xingxiang@itiger.com',
      password: '$2a$10$XOQcw4TIIFrRpbAShYAsN.69hqtDyvMK2uLaDnv7BavL/Xmcjke66', // admin123
      firstName: 'Xing',
      lastName: 'Xiang',
      company: 'iTiger',
      role: 'Admin',
      department: 'Management',
      status: 'Active',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // 初始化示例潜在客户
    const lead1Id = String(this.leadIdCounter++)
    this.leads.set(lead1Id, {
      _id: lead1Id,
      name: 'TechCorp Inc.',
      contact: 'John Smith',
      email: 'john@techcorp.com',
      phone: '+1 (555) 123-4567',
      source: 'Website',
      status: 'New',
      priority: 'High',
      value: 250000,
      assignedTo: 'Admin User',
      notes: 'Interested in enterprise solution',
      createdAt: new Date('2024-01-15'),
      lastContact: new Date('2024-01-15'),
      updatedAt: new Date(),
    })
  }

  // Users
  async findUser(query: any): Promise<User | null> {
    for (const user of this.users.values()) {
      if (query.email && user.email === query.email) return user
      if (query._id && user._id === query._id) return user
    }
    return null
  }

  async findUsers(query: any = {}): Promise<User[]> {
    let users = Array.from(this.users.values())
    
    if (query.$or) {
      const searchTerm = query.$or[0]?.firstName?.$regex || ''
      users = users.filter(u => 
        u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    if (query.role) users = users.filter(u => u.role === query.role)
    if (query.status) users = users.filter(u => u.status === query.status)
    
    return users
  }

  async insertUser(user: Omit<User, '_id'>): Promise<{ insertedId: string }> {
    const id = String(this.userIdCounter++)
    this.users.set(id, { ...user, _id: id })
    return { insertedId: id }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<{ matchedCount: number }> {
    const user = this.users.get(id)
    if (!user) return { matchedCount: 0 }
    
    this.users.set(id, { ...user, ...updates, _id: id })
    return { matchedCount: 1 }
  }

  async deleteUser(id: string): Promise<{ deletedCount: number }> {
    const deleted = this.users.delete(id)
    return { deletedCount: deleted ? 1 : 0 }
  }

  // Leads
  async findLead(query: any): Promise<Lead | null> {
    for (const lead of this.leads.values()) {
      if (query._id && lead._id === query._id) return lead
    }
    return null
  }

  async findLeads(query: any = {}): Promise<Lead[]> {
    let leads = Array.from(this.leads.values())
    
    if (query.$or) {
      const searchTerm = query.$or[0]?.name?.$regex || ''
      leads = leads.filter(l => 
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    if (query.status) leads = leads.filter(l => l.status === query.status)
    if (query.priority) leads = leads.filter(l => l.priority === query.priority)
    
    return leads
  }

  async insertLead(lead: Omit<Lead, '_id'>): Promise<{ insertedId: string }> {
    const id = String(this.leadIdCounter++)
    this.leads.set(id, { ...lead, _id: id })
    return { insertedId: id }
  }

  async updateLead(id: string, updates: Partial<Lead>): Promise<{ matchedCount: number }> {
    const lead = this.leads.get(id)
    if (!lead) return { matchedCount: 0 }
    
    this.leads.set(id, { ...lead, ...updates, _id: id })
    return { matchedCount: 1 }
  }

  async deleteLead(id: string): Promise<{ deletedCount: number }> {
    const deleted = this.leads.delete(id)
    return { deletedCount: deleted ? 1 : 0 }
  }
}

const inMemoryDB = new InMemoryDB()

export function getInMemoryDB() {
  return inMemoryDB
}
