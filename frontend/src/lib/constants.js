export const APPLICATION_STATUSES = [
  "Saved / Interested", "Applied", "Application Acknowledged", "Recruiter Contacted",
  "Assessment Received", "Assessment Pending", "Assessment Completed", "Assessment Passed",
  "Assessment Failed", "Interview Scheduled", "Interview Completed", "Awaiting Interview Feedback",
  "Technical Round", "HR Round", "Managerial Round", "Final Round", "Offer Received",
  "Offer Accepted", "Joined", "Rejected", "Withdrawn", "On Hold", "No Response", "Position Closed",
];

export const STATUS_COLORS = {
  "Saved / Interested": "slate", "Applied": "blue", "Application Acknowledged": "blue",
  "Recruiter Contacted": "blue", "Assessment Received": "amber", "Assessment Pending": "amber",
  "Assessment Completed": "indigo", "Assessment Passed": "emerald", "Assessment Failed": "red",
  "Interview Scheduled": "violet", "Interview Completed": "indigo", "Awaiting Interview Feedback": "amber",
  "Technical Round": "violet", "HR Round": "violet", "Managerial Round": "violet", "Final Round": "violet",
  "Offer Received": "emerald", "Offer Accepted": "emerald", "Joined": "emerald",
  "Rejected": "red", "Withdrawn": "slate", "On Hold": "amber", "No Response": "slate", "Position Closed": "slate",
};

export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Freelance", "Temporary"];
export const WORK_ARRANGEMENTS = ["Remote", "Hybrid", "Office"];
export const APPLICATION_SOURCES = ["LinkedIn", "Company Website", "Naukri", "Indeed", "Referral", "Job Portal", "Recruiter", "Email", "Other"];

export const ASSESSMENT_TYPES = ["Coding Assessment", "Technical MCQ", "Aptitude", "Language Assessment", "AI Interview", "Video Interview", "Take-home Assignment", "Automation Testing", "Manual Testing", "Domain Knowledge", "Other"];
export const ASSESSMENT_STATUSES = ["Received", "Not Started", "In Progress", "Pending", "Submitted", "Completed", "Passed", "Failed", "Expired", "Cancelled"];
export const ASSESSMENT_RESULTS = ["Pending", "Passed", "Failed", "Awaiting Result"];

export const INTERVIEW_ROUNDS = ["Screening", "Round 1", "Round 2", "Round 3", "Technical", "HR", "Managerial", "Final"];
export const INTERVIEW_TYPES = ["HR Interview", "Technical Interview", "Coding Interview", "Managerial Interview", "Language Interview", "AI Video Interview", "Client Interview", "Final Interview"];
export const INTERVIEW_STATUSES = ["Scheduled", "Rescheduled", "Completed", "Passed", "Failed", "Awaiting Feedback", "Cancelled"];

export const REMINDER_TYPES = ["Assessment Deadline", "Interview", "Recruiter Follow-up", "Application Follow-up", "Document Submission", "Offer Response", "Other"];
export const REMINDER_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
export const REMINDER_STATUSES = ["Pending", "Completed", "Snoozed", "Cancelled"];

export const PRIORITY_COLORS = { Low: "slate", Medium: "blue", High: "amber", Urgent: "red" };
