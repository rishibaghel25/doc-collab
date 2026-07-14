import { NextRequest, NextResponse } from 'next/server';
import * as mammoth from 'mammoth';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse docx using mammoth
    const result = await mammoth.convertToHtml({ buffer });
    
    return NextResponse.json({
      html: result.value,
      warnings: (result as any).warnings || [],
    });
  } catch (error: any) {
    console.error('Error parsing docx file:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse docx file.' },
      { status: 500 }
    );
  }
}
export const dynamic = 'force-dynamic';
