// Static course catalogue. Replace with Firestore later — the shape is kept
// flat and explicit so the swap is mechanical.

export const COURSE_CATEGORIES = ['All', 'Beginner', 'Intermediate', 'Advanced'];

const PALETTE = [
    { rail: '#6366F1', tile: '#EEF2FF', strong: '#4F46E5' }, // indigo
    { rail: '#EC4899', tile: '#FCE7F3', strong: '#DB2777' }, // pink
    { rail: '#06B6D4', tile: '#CFFAFE', strong: '#0891B2' }, // cyan
    { rail: '#10B981', tile: '#D1FAE5', strong: '#059669' }, // emerald
    { rail: '#F59E0B', tile: '#FEF3C7', strong: '#D97706' }, // amber
    { rail: '#8B5CF6', tile: '#EDE9FE', strong: '#7C3AED' }, // violet
    { rail: '#14B8A6', tile: '#CCFBF1', strong: '#0D9488' }, // teal
    { rail: '#F43F5E', tile: '#FFE4E6', strong: '#E11D48' }, // rose
];

export const paletteFor = (id = '') => {
    let h = 0;
    for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
    return PALETTE[Math.abs(h) % PALETTE.length];
};

// Level-based palette — every Beginner course shares one theme, every
// Intermediate course shares another, every Advanced course shares a third.
// Use this when the level should be visually identifiable at a glance.
// Each level has both:
//   - solid tokens (rail/tile/strong) for chips, tabs, icons, prices
//   - gradient[] for hero/cover surfaces rendered with LinearGradient
//   - onGradient: whether to use light or dark text over the gradient surface
export const LEVEL_PALETTE = {
    Beginner: {
        rail: '#10B981', tile: '#D1FAE5', strong: '#065F46',
        gradient: ['#A7F3D0', '#6EE7B7', '#10B981'], // soft mint → emerald (calm, welcoming)
        onGradient: 'dark',
    },
    Intermediate: {
        rail: '#F97316', tile: '#FED7AA', strong: '#9A3412',
        gradient: ['#FED7AA', '#FB7185', '#1E3A8A'], // peach → coral → navy (sunset energy)
        onGradient: 'light',
    },
    Advanced: {
        rail: '#DC2626', tile: '#FEE2E2', strong: '#7F1D1D',
        gradient: ['#EF4444', '#991B1B', '#0F172A'], // vivid red → dark (intense mastery)
        onGradient: 'light',
    },
};

export const paletteForLevel = (level = '') => LEVEL_PALETTE[level] || LEVEL_PALETTE.Intermediate;

export const COURSES = [
    {
        id: 'c-math-jee',
        title: 'JEE Advanced Mathematics',
        subtitle: 'Master Calculus, Algebra & Coordinate Geometry',
        instructor: 'Dr. Rajeev Sharma',
        instructorTitle: 'IIT Bombay • 12 yrs teaching',
        icon: 'square-root-alt',
        type: 'Live',
        level: 'Advanced',
        category: 'Advanced',
        durationWeeks: 24,
        totalHours: 180,
        lessons: 96,
        schedule: 'Mon, Wed, Fri • 6:00 PM',
        language: 'English / Hindi',
        rating: 4.8,
        ratingCount: 1243,
        students: 5240,
        price: 12999,
        originalPrice: 18999,
        about: 'A complete preparation track for JEE Advanced Mathematics. Covers every chapter from NCERT through to advanced problem-solving, with weekly mock tests and personalised doubt sessions.',
        learnings: [
            'Crack JEE-level Calculus, Algebra and Coordinate Geometry problems',
            'Pattern recognition for shortcut techniques in MCQs',
            'Time-management strategy across the 3-hour paper',
            'Approach for integer-type and matching-list questions',
        ],
        modules: [
            { title: 'Sets, Relations & Functions', lessons: 8, hours: 14 },
            { title: 'Limits, Continuity & Differentiability', lessons: 12, hours: 22 },
            { title: 'Integral Calculus', lessons: 14, hours: 26 },
            { title: 'Vector & 3D Geometry', lessons: 10, hours: 18 },
            { title: 'Probability & Combinatorics', lessons: 9, hours: 16 },
        ],
    },
    {
        id: 'c-phy-neet',
        title: 'NEET Physics Crash Course',
        subtitle: 'Concepts + Numericals in 8 weeks',
        instructor: 'Prof. Anjali Verma',
        instructorTitle: 'AIIMS Mentor • 9 yrs teaching',
        icon: 'atom',
        type: 'Hybrid',
        level: 'Intermediate',
        category: 'Intermediate',
        durationWeeks: 8,
        totalHours: 64,
        lessons: 48,
        schedule: 'Tue, Thu, Sat • 5:00 PM',
        language: 'English / Hindi',
        rating: 4.7,
        ratingCount: 892,
        students: 3120,
        price: 4999,
        originalPrice: 7999,
        about: 'A focused 8-week sprint aimed at NEET aspirants. Every session ends with a numerical drill so concepts and speed build together.',
        learnings: [
            'Quick recall of all NEET-relevant formulae',
            'Solve numericals under 60 seconds',
            'Common trap-questions and how to spot them',
            'Revision strategy for the last 30 days',
        ],
        modules: [
            { title: 'Kinematics & Laws of Motion', lessons: 8, hours: 10 },
            { title: 'Work, Energy & Rotational Motion', lessons: 10, hours: 13 },
            { title: 'Thermodynamics & Kinetic Theory', lessons: 9, hours: 12 },
            { title: 'Electrostatics & Current Electricity', lessons: 11, hours: 16 },
            { title: 'Modern Physics', lessons: 10, hours: 13 },
        ],
    },
    {
        id: 'c-eng-spoken',
        title: 'Spoken English Mastery',
        subtitle: 'Fluency, accent & confidence in 12 weeks',
        instructor: 'Ms. Priya Iyer',
        instructorTitle: 'Cambridge CELTA • 7 yrs',
        icon: 'comments',
        type: 'Live',
        level: 'Beginner',
        category: 'Beginner',
        durationWeeks: 12,
        totalHours: 48,
        lessons: 36,
        schedule: 'Mon to Fri • 7:30 PM',
        language: 'English',
        rating: 4.9,
        ratingCount: 2104,
        students: 7820,
        price: 2499,
        originalPrice: 3999,
        about: 'Build everyday English fluency through role-play, real conversations and accent drills. Designed for learners who can read English but freeze when they speak.',
        learnings: [
            'Hold a 10-minute conversation on any everyday topic',
            'Neutral accent and clear pronunciation',
            'Interview-ready answers for common questions',
            'Email and WhatsApp writing for professional contexts',
        ],
        modules: [
            { title: 'Foundation: Tenses & Sentence Shapes', lessons: 8, hours: 10 },
            { title: 'Daily Conversations & Role-play', lessons: 10, hours: 14 },
            { title: 'Pronunciation & Accent Neutralisation', lessons: 8, hours: 12 },
            { title: 'Interview & Public Speaking', lessons: 10, hours: 12 },
        ],
    },
    {
        id: 'c-cs-fullstack',
        title: 'Full-Stack Web Development',
        subtitle: 'React, Node.js, MongoDB & Deployment',
        instructor: 'Mr. Karan Mehta',
        instructorTitle: 'Ex-Flipkart • 8 yrs SDE',
        icon: 'laptop-code',
        type: 'Recorded',
        level: 'Intermediate',
        category: 'Intermediate',
        durationWeeks: 16,
        totalHours: 120,
        lessons: 84,
        schedule: 'Self-paced • Weekly office hours',
        language: 'English / Hindi',
        rating: 4.6,
        ratingCount: 1560,
        students: 6410,
        price: 6999,
        originalPrice: 9999,
        about: 'Project-led MERN stack track. You will ship four production-grade projects and learn how to deploy them on Vercel and Render.',
        learnings: [
            'Build responsive React apps with hooks and Context',
            'Design REST APIs with Express + MongoDB',
            'Authentication, payments and file uploads',
            'CI/CD and production deployment',
        ],
        modules: [
            { title: 'JavaScript & ES6+ Deep Dive', lessons: 12, hours: 16 },
            { title: 'React Fundamentals & Hooks', lessons: 16, hours: 24 },
            { title: 'Node.js, Express & REST APIs', lessons: 14, hours: 22 },
            { title: 'MongoDB & Mongoose', lessons: 12, hours: 18 },
            { title: 'Auth, Payments & Deployment', lessons: 14, hours: 20 },
            { title: 'Capstone Project', lessons: 16, hours: 20 },
        ],
    },
    {
        id: 'c-chem-jee',
        title: 'Organic Chemistry Foundation',
        subtitle: 'Mechanisms made simple',
        instructor: 'Dr. Suresh Pillai',
        instructorTitle: 'IIT Madras • 15 yrs',
        icon: 'flask',
        type: 'Live',
        level: 'Intermediate',
        category: 'Intermediate',
        durationWeeks: 10,
        totalHours: 50,
        lessons: 40,
        schedule: 'Mon, Wed, Fri • 4:30 PM',
        language: 'English / Hindi',
        rating: 4.7,
        ratingCount: 612,
        students: 1980,
        price: 3499,
        originalPrice: 5499,
        about: 'Stop memorising reactions and start understanding them. This course walks through every key mechanism with concept maps.',
        learnings: [
            'Reaction mechanism logic for every chapter',
            'Convert any IUPAC name confidently',
            'Predict products in unfamiliar reactions',
            'Crack assertion-reason questions',
        ],
        modules: [
            { title: 'GOC & Isomerism', lessons: 10, hours: 12 },
            { title: 'Hydrocarbons', lessons: 8, hours: 10 },
            { title: 'Haloalkanes & Haloarenes', lessons: 8, hours: 10 },
            { title: 'Alcohols, Phenols & Ethers', lessons: 7, hours: 9 },
            { title: 'Aldehydes, Ketones & Acids', lessons: 7, hours: 9 },
        ],
    },
    {
        id: 'c-design-ui',
        title: 'UI/UX Design Bootcamp',
        subtitle: 'From Figma to portfolio',
        instructor: 'Ms. Neha Kapoor',
        instructorTitle: 'Senior Designer • Razorpay',
        icon: 'palette',
        type: 'Hybrid',
        level: 'Beginner',
        category: 'Beginner',
        durationWeeks: 8,
        totalHours: 40,
        lessons: 32,
        schedule: 'Tue, Thu, Sat • 8:00 PM',
        language: 'English',
        rating: 4.8,
        ratingCount: 740,
        students: 2510,
        price: 5499,
        originalPrice: 7999,
        about: 'A practical track on visual and product design. By the end you will have a portfolio of three case studies and a working Figma workflow.',
        learnings: [
            'Figma from setup to advanced components',
            'Design tokens, type scales and colour systems',
            'Wireframing → high-fidelity → handoff',
            'Building a case-study driven portfolio',
        ],
        modules: [
            { title: 'Design Fundamentals', lessons: 6, hours: 6 },
            { title: 'Figma Mastery', lessons: 10, hours: 14 },
            { title: 'UX Research & Wireframes', lessons: 8, hours: 10 },
            { title: 'Portfolio & Case Studies', lessons: 8, hours: 10 },
        ],
    },
];

export const getCourseById = id => COURSES.find(c => c.id === id);

export const formatPrice = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
