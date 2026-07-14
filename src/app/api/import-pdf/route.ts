import { NextRequest, NextResponse } from 'next/server';
// Import the core parser directly to bypass the buggy index.js debug execution
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';

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

    // Parse PDF using classic pdf-parse lib directly
    const parsedData = await pdf(buffer);
    const text = parsedData.text || '';

    // Convert plain text lines to HTML paragraphs
    const html = text
      .split('\n')
      .map((line: string) => {
        const clean = line.trim();
        return clean === '' ? '<p><br></p>' : `<p>${clean}</p>`;
      })
      .join('');

    return NextResponse.json({
      html,
    });
  } catch (error: any) {
    console.error('Error parsing PDF file:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse PDF file.' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
