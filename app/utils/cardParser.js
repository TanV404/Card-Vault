export const parseOCROutput = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const data = {
    company_name: '',
    person_name: '',
    designation: '',
    phone: '',
    email: '',
    address: ''
  };

  // 1. Find Email (Very accurate)
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  
  // 2. Find Phone (Looks for patterns like +1-555... or (555) or 10-digit numbers)
  const phoneRegex = /(?:(?:\+|00)[\d]{1,3}[ -]?)?[\d]{1,4}[ -]?[\d]{1,4}[ -]?[\d]{1,9}/g;

  // 3. Find specific keywords for Designation
  const roles = ['manager', 'director', 'ceo', 'founder', 'engineer', 'developer', 'sales', 'representative', 'consultant', 'lead'];

  lines.forEach((line, index) => {
    // Check for Email
    if (line.match(emailRegex) && !data.email) {
      data.email = line.match(emailRegex)[0];
      return; 
    }

    // Check for Phone (Filter out short numbers to avoid dates/zip codes)
    const phoneMatch = line.match(phoneRegex);
    if (phoneMatch && !data.phone) {
      const p = phoneMatch[0];
      if (p.replace(/\D/g, '').length > 6) { // Ensure it has at least 7 digits
        data.phone = p;
        return;
      }
    }

    // Check for Designation
    if (roles.some(role => line.toLowerCase().includes(role)) && !data.designation) {
      data.designation = line;
      return;
    }

    // Guessing Name & Company (The hardest part with simple OCR)
    // Strategy: The first non-email/phone line is usually the Company or Name.
    if (!data.company_name && index === 0) {
      data.company_name = line;
    } else if (!data.person_name && index === 1) {
      data.person_name = line;
    } else if (!data.address && /\d+/.test(line) && (line.includes('St') || line.includes('Rd') || line.includes('Ave') || line.includes('Lane') || line.includes(','))) {
      // Heuristic: Has numbers and address keywords
      data.address = line;
    }
  });

  return data;
};