import { NextResponse } from "next/server";
import bcrypt from "bcryptjs"; 
import { prisma } from "@/lib/prisma"; 

export async function POST(req: Request) {
  try {
    const { name, email, password, role } = await req.json();

    // 1. Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    // 2. Hash Password 
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Store in Database
    const newUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role, // ATTORNEY
      },
    });

    return NextResponse.json({ message: "User registered successfully" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
