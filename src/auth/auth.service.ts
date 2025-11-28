import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.status !== 'active') {
      return null;
    }

    // Si c'est un admin, vérifier le mot de passe
    if (user.role === 'admin' && password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        console.log('❌ [AuthService] Mot de passe admin incorrect');
        return null;
      }
      console.log('✅ [AuthService] Mot de passe admin correct');
    }

    return user;
  }

  async login(email: string | any, password?: string) {
    console.log('🔑 [AuthService] Tentative de connexion pour:', email);
    
    // Si email est un objet, extraire la vraie valeur email et password
    const actualEmail = typeof email === 'string' ? email : email.email;
    const actualPassword = typeof email === 'string' ? password : email.password;
    console.log('📧 [AuthService] Email extrait:', actualEmail);
    console.log('🔑 [AuthService] Password fourni:', !!actualPassword);
    
    // Vérifier si l'utilisateur existe
    let user = await this.validateUser(actualEmail, actualPassword);
    
    // Si l'utilisateur n'existe pas ET ce n'est pas un admin, le créer automatiquement
    if (!user && actualEmail !== 'admin@kamri.com') {
      console.log('👤 [AuthService] Utilisateur non trouvé, création automatique...');
      user = await this.createUser(actualEmail, actualEmail.split('@')[0], 'auto-generated');
      console.log('✅ [AuthService] Utilisateur créé:', user.id);
    } else if (user) {
      console.log('✅ [AuthService] Utilisateur trouvé:', user.id, 'Role:', user.role);
    } else {
      console.log('❌ [AuthService] Connexion échouée - utilisateur non trouvé ou mot de passe incorrect');
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const payload = { 
      email: user.email, 
      sub: user.id, 
      role: user.role 
    };

    // Générer le token avec expiration explicite de 7 jours
    const token = this.jwtService.sign(payload, { expiresIn: '7d' });
    console.log('🎫 [AuthService] Token JWT généré avec expiration de 7 jours');
    console.log('🔐 [AuthService] Token preview:', token.substring(0, 50) + '...');
    
    // Vérifier la structure du token
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadDecoded = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log('📋 [AuthService] Payload du token:', payloadDecoded);
        console.log('📅 [AuthService] Token créé à:', new Date(payloadDecoded.iat * 1000));
        if (payloadDecoded.exp) {
          const expiryDate = new Date(payloadDecoded.exp * 1000);
          console.log('⏰ [AuthService] Token expire à:', expiryDate);
          console.log('⏰ [AuthService] Token valide pendant:', Math.round((payloadDecoded.exp - payloadDecoded.iat) / 3600), 'heures');
        }
      }
    } catch (e) {
      console.error('❌ [AuthService] Erreur décodage token:', e);
    }

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async register(email: string | any, name: string, password: string = 'auto-generated', role: string = 'user') {
    // Si email est un objet, extraire la vraie valeur email
    const actualEmail = typeof email === 'string' ? email : email.email;
    console.log('📧 [AuthService] Email extrait pour register:', actualEmail);
    
    const existingUser = await this.prisma.user.findUnique({
      where: { email: actualEmail },
    });

    if (existingUser) {
      throw new UnauthorizedException('Un utilisateur avec cet email existe déjà');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await this.prisma.user.create({
      data: {
        email: actualEmail,
        name,
        password: hashedPassword,
        role,
        status: 'active',
      },
    });

    const payload = { 
      email: user.email, 
      sub: user.id, 
      role: user.role 
    };

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async createUser(email: string | any, name: string, password: string) {
    // Si email est un objet, extraire la vraie valeur email
    const actualEmail = typeof email === 'string' ? email : email.email;
    console.log('📧 [AuthService] Email extrait pour createUser:', actualEmail);
    
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        email: actualEmail,
        name,
        password: hashedPassword,
        role: 'user',
        status: 'active',
      },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    return user;
  }

  async updateProfile(userId: string, data: { name?: string; email?: string }) {
    console.log('👤 [AuthService] Mise à jour du profil pour:', userId, data);
    
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    console.log('✅ [AuthService] Profil mis à jour:', user.id);
    return user;
  }

  async createAdminUser() {
    console.log('🔐 [AuthService] Création de l\'utilisateur admin...');
    
    try {
      // Vérifier si l'admin existe déjà
      const existingAdmin = await this.prisma.user.findUnique({
        where: { email: 'admin@kamri.com' }
      });

      if (existingAdmin) {
        console.log('✅ [AuthService] Admin existe déjà, mise à jour du mot de passe...');
        
        // Mettre à jour le mot de passe
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const updatedAdmin = await this.prisma.user.update({
          where: { email: 'admin@kamri.com' },
          data: { 
            password: hashedPassword,
            role: 'admin',
            status: 'active'
          }
        });
        
        return {
          message: 'Admin mis à jour avec succès',
          user: {
            id: updatedAdmin.id,
            email: updatedAdmin.email,
            name: updatedAdmin.name,
            role: updatedAdmin.role
          }
        };
      } else {
        console.log('👤 [AuthService] Création de l\'admin...');
        
        // Créer l'admin avec mot de passe hashé
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const admin = await this.prisma.user.create({
          data: {
            email: 'admin@kamri.com',
            name: 'Admin KAMRI',
            password: hashedPassword,
            role: 'admin',
            status: 'active',
          },
        });
        
        return {
          message: 'Admin créé avec succès',
          user: {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role
          }
        };
      }
    } catch (error) {
      console.error('❌ [AuthService] Erreur lors de la création de l\'admin:', error);
      throw error;
    }
  }
}

