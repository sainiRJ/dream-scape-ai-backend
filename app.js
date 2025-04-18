require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const html_to_pdf = require('html-pdf-node');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const sanitizeMarkdownToHTML = require('./utils/sanitizer');

const app = express();
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const generatePDF = async (html, filePath) => {
  const bannerPath = path.join(__dirname, 'banner.png');
  const bannerBase64 = fs.readFileSync(bannerPath).toString('base64');
  const finalHtml = html.replace(/banner\.png/g, `data:image/png;base64,${bannerBase64}`);
  const file = { content: finalHtml };
  const pdfBuffer = await html_to_pdf.generatePdf(file, { format: 'A4' });
  fs.writeFileSync(filePath, pdfBuffer);
};

const loadTemplate = (templatePath) => {
  return fs.readFileSync(path.join(__dirname, templatePath), 'utf-8');
};

app.post('/generate-reports', async (req, res) => {
  const { name, questions, answers } = req.body;
  if (!name || !Array.isArray(questions) || !Array.isArray(answers) || questions.length !== 5 || answers.length !== 5) {
    return res.status(400).json({ message: 'Invalid input. Must include name, 5 questions, and 5 answers.' });
  }

  try {
    const formattedQA = questions.map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${answers[i]}`).join('\n\n');

    const clientPrompt = `
You are DreamScape AI GPT.

Generate a Client Assessment Report using this structure:
- No greeting (e.g., don't use "Dear")
- No signature (e.g., avoid "Warm regards")
- Tone should be human, professional, and warm

STRUCTURE:

1. Opening paragraph (begin with the name and reflectively set the tone)

2. For each question:
Q: [insert question]
- Client Response: (verbatim)
- DreamScape AI Reflection: (thoughtful response)

3. Closing Summary:
- Bullet list: What the Neuro Change Method Can Do
- Paragraph: Why Now, Why You, and Why a Neuro Change Practitioner?

Name: ${name}

${formattedQA}`.trim();

    const practitionerPrompt = `
You are DreamScape AI GPT.

Generate a Practitioner Case Report using this structure:
1. Client Summary
2. Transformation Theme
3. 4 Phases:
   - Phase Name
   - Focus
   - Tools
   - Goal
4. 12-Week Milestone Table (Respond as valid HTML <table> with 3 columns: Milestone | Target Week | Tools & Focus)
5. Practitioner Notes
6. Projected Outcomes (as bullet list)
7. Best Practices (as bullet list)

Name: ${name}

${formattedQA}`.trim();

    const [clientRes, practitionerRes] = await Promise.all([
      openai.chat.completions.create({
        messages: [{ role: 'user', content: clientPrompt }],
        model: 'gpt-4o'
      }),
      openai.chat.completions.create({
        messages: [{ role: 'user', content: practitionerPrompt }],
        model: 'gpt-4o'
      })
    ]);

    const clientReport = sanitizeMarkdownToHTML(clientRes.choices[0].message.content);
    const practitionerReport = sanitizeMarkdownToHTML(practitionerRes.choices[0].message.content);

    const clientTemplate = loadTemplate('./templates/clientTemplate.html');
    const practitionerTemplate = loadTemplate('./templates/practitionerTemplate.html');

    const clientHtml = clientTemplate
      .replace(/{{name}}/g, name)
      .replace('{{{clientReport}}}', clientReport);

    const practitionerHtml = practitionerTemplate
      .replace(/{{name}}/g, name)
      .replace('{{{practitionerReport}}}', practitionerReport);

    const safeName = name.trim().replace(/\s+/g, '_');
    await generatePDF(clientHtml, `./pdfs/${safeName}_client.pdf`);
    await generatePDF(practitionerHtml, `./pdfs/${safeName}_practitioner.pdf`);

    res.json({ message: 'PDFs generated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error generating reports', error });
  }
});

app.listen(3000, () => console.log('Server running at http://localhost:3000'));
