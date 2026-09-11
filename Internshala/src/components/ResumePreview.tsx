import React from "react";
import {
  Mail,
  Phone,
  MapPin,
  Globe,
  Briefcase,
  BookOpen,
  Code,
  Award,
  CheckCircle,
  User,
} from "lucide-react";

export type TemplateType = "Modern" | "Classic" | "Minimalist";

export interface ResumeData {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  summary?: string;
  photo?: string;
  education?: Array<{
    institution: string;
    degree: string;
    field: string;
    startYear: string;
    endYear: string;
    cgpa: string;
  }>;
  experience?: Array<{
    company: string;
    role: string;
    startDate: string;
    endDate: string;
    description: string;
  }>;
  projects?: Array<{
    title: string;
    description: string;
    technologies: string[];
    github?: string;
    liveLink?: string;
  }>;
  skills?: string[];
  certifications?: Array<{
    title: string;
    organization: string;
    year: string;
  }>;
  achievements?: string[];
}

interface ResumePreviewProps {
  data: ResumeData;
  selectedTemplate: TemplateType;
  onTemplateChange?: (template: TemplateType) => void;
}

const ResumePreview: React.FC<ResumePreviewProps> = ({
  data,
  selectedTemplate,
  onTemplateChange,
}) => {
  const templates: { id: TemplateType; label: string; description: string }[] = [
    { id: "Modern", label: "Modern", description: "2-column layout with vibrant accents & badges" },
    { id: "Classic", label: "Classic", description: "Traditional serif layout with centered header" },
    { id: "Minimalist", label: "Minimalist", description: "Clean single-column layout with left border accent" },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Template Selector Controls */}
      {onTemplateChange && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
            Select Resume Template
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {templates.map((tpl) => {
              const isSelected = selectedTemplate === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onTemplateChange(tpl.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all duration-200 relative ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/40 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-900 text-base">{tpl.label}</span>
                    {isSelected && <CheckCircle className="w-5 h-5 text-blue-600" />}
                  </div>
                  <p className="text-xs text-gray-500">{tpl.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Resume Live Canvas Container */}
      <div className="overflow-x-auto pb-4">
        <div className="w-full max-w-[800px] min-h-[1050px] mx-auto bg-white shadow-2xl border border-gray-200 text-gray-800 transition-all duration-300">
          {/* RENDER SELECTED TEMPLATE */}
          {selectedTemplate === "Modern" && <ModernTemplate data={data} />}
          {selectedTemplate === "Classic" && <ClassicTemplate data={data} />}
          {selectedTemplate === "Minimalist" && <MinimalistTemplate data={data} />}
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   TEMPLATE 1: MODERN TEMPLATE
   ========================================================= */
const ModernTemplate: React.FC<{ data: ResumeData }> = ({ data }) => {
  return (
    <div className="flex flex-col min-h-[1050px]">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {data.name || "Your Name"}
          </h1>
          {data.summary && (
            <p className="text-xs sm:text-sm text-blue-200/90 leading-relaxed max-w-xl">
              {data.summary}
            </p>
          )}
        </div>
        {data.photo ? (
          <img
            src={data.photo}
            alt={data.name}
            className="w-28 h-28 rounded-full object-cover border-4 border-white/20 shadow-xl flex-shrink-0"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center border-2 border-white/20 flex-shrink-0">
            <User className="w-12 h-12 text-white/50" />
          </div>
        )}
      </div>

      {/* 2-Column Body */}
      <div className="grid grid-cols-1 md:grid-cols-3 flex-1 p-8 gap-8">
        {/* Left Column (Sidebar: Contact & Skills & Certs) */}
        <div className="md:col-span-1 space-y-6 border-r border-gray-100 pr-0 md:pr-6">
          {/* Contact Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider pb-1 border-b border-blue-100">
              Contact
            </h3>
            <div className="space-y-2 text-xs text-gray-600">
              {data.email && (
                <div className="flex items-center gap-2 break-all">
                  <Mail className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span>{data.email}</span>
                </div>
              )}
              {data.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span>{data.phone}</span>
                </div>
              )}
              {data.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span>{data.address}</span>
                </div>
              )}
              {data.linkedin && (
                <div className="flex items-center gap-2 break-all">
                  <Globe className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <a href={data.linkedin} target="_blank" rel="noreferrer" className="hover:underline">
                    LinkedIn
                  </a>
                </div>
              )}
              {data.github && (
                <div className="flex items-center gap-2 break-all">
                  <Globe className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <a href={data.github} target="_blank" rel="noreferrer" className="hover:underline">
                    GitHub
                  </a>
                </div>
              )}
              {data.portfolio && (
                <div className="flex items-center gap-2 break-all">
                  <Globe className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <a href={data.portfolio} target="_blank" rel="noreferrer" className="hover:underline">
                    Portfolio
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Skills */}
          {data.skills && data.skills.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider pb-1 border-b border-blue-100">
                Skills
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {data.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-md font-medium border border-blue-100"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {data.certifications && data.certifications.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider pb-1 border-b border-blue-100">
                Certifications
              </h3>
              <div className="space-y-2">
                {data.certifications.map((cert, idx) => (
                  <div key={idx} className="text-xs">
                    <p className="font-semibold text-gray-800">{cert.title}</p>
                    <p className="text-gray-500">
                      {cert.organization} {cert.year ? `(${cert.year})` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Main Details: Experience, Education, Projects) */}
        <div className="md:col-span-2 space-y-6">
          {/* Experience */}
          {data.experience && data.experience.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider pb-1 border-b-2 border-blue-600 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-blue-600" />
                Work Experience
              </h3>
              <div className="space-y-4">
                {data.experience.map((exp, idx) => (
                  <div key={idx} className="space-y-1 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-sm text-gray-900">{exp.role}</span>
                      <span className="text-gray-500 font-medium">
                        {exp.startDate} - {exp.endDate}
                      </span>
                    </div>
                    <p className="font-semibold text-blue-700">{exp.company}</p>
                    {exp.description && (
                      <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {data.projects && data.projects.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider pb-1 border-b-2 border-blue-600 flex items-center gap-1.5">
                <Code className="w-4 h-4 text-blue-600" />
                Projects
              </h3>
              <div className="space-y-4">
                {data.projects.map((proj, idx) => (
                  <div key={idx} className="space-y-1 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-sm text-gray-900">{proj.title}</span>
                      <div className="space-x-2 text-blue-600">
                        {proj.github && (
                          <a href={proj.github} target="_blank" rel="noreferrer" className="hover:underline">
                            Code
                          </a>
                        )}
                        {proj.liveLink && (
                          <a href={proj.liveLink} target="_blank" rel="noreferrer" className="hover:underline">
                            Live Demo
                          </a>
                        )}
                      </div>
                    </div>
                    {proj.technologies && proj.technologies.length > 0 && (
                      <p className="text-gray-500 font-medium">
                        Tech: {proj.technologies.join(", ")}
                      </p>
                    )}
                    {proj.description && (
                      <p className="text-gray-600 leading-relaxed">{proj.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {data.education && data.education.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider pb-1 border-b-2 border-blue-600 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-blue-600" />
                Education
              </h3>
              <div className="space-y-3">
                {data.education.map((edu, idx) => (
                  <div key={idx} className="flex justify-between items-start text-xs">
                    <div>
                      <p className="font-bold text-sm text-gray-900">{edu.institution}</p>
                      <p className="text-gray-700">
                        {edu.degree} {edu.field ? `in ${edu.field}` : ""}
                      </p>
                      {edu.cgpa && <p className="text-gray-500">CGPA: {edu.cgpa}</p>}
                    </div>
                    <span className="text-gray-500 font-medium">
                      {edu.startYear} - {edu.endYear}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Achievements */}
          {data.achievements && data.achievements.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider pb-1 border-b-2 border-blue-600 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-blue-600" />
                Key Achievements
              </h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-gray-600">
                {data.achievements.map((ach, idx) => (
                  <li key={idx}>{ach}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   TEMPLATE 2: CLASSIC TEMPLATE
   ========================================================= */
const ClassicTemplate: React.FC<{ data: ResumeData }> = ({ data }) => {
  return (
    <div className="p-8 sm:p-12 font-serif text-gray-900 space-y-6">
      {/* Header */}
      <div className="text-center border-b-2 border-gray-900 pb-6 space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wide">
          {data.name || "Your Name"}
        </h1>
        <div className="flex flex-wrap justify-center items-center gap-4 text-xs font-sans text-gray-700">
          {data.email && <span>{data.email}</span>}
          {data.phone && <span>• {data.phone}</span>}
          {data.address && <span>• {data.address}</span>}
          {data.linkedin && (
            <span>
              •{" "}
              <a href={data.linkedin} target="_blank" rel="noreferrer" className="underline">
                LinkedIn
              </a>
            </span>
          )}
          {data.github && (
            <span>
              •{" "}
              <a href={data.github} target="_blank" rel="noreferrer" className="underline">
                GitHub
              </a>
            </span>
          )}
        </div>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider border-b border-gray-400 pb-1">
            Professional Summary
          </h2>
          <p className="text-xs leading-relaxed text-gray-800 italic">{data.summary}</p>
        </div>
      )}

      {/* Experience */}
      {data.experience && data.experience.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider border-b border-gray-400 pb-1">
            Work Experience
          </h2>
          {data.experience.map((exp, idx) => (
            <div key={idx} className="space-y-1 text-xs">
              <div className="flex justify-between font-bold">
                <span>{exp.role} — {exp.company}</span>
                <span>
                  {exp.startDate} – {exp.endDate}
                </span>
              </div>
              {exp.description && (
                <p className="text-gray-800 leading-relaxed font-sans">{exp.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      {data.projects && data.projects.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider border-b border-gray-400 pb-1">
            Projects
          </h2>
          {data.projects.map((proj, idx) => (
            <div key={idx} className="space-y-1 text-xs">
              <div className="flex justify-between font-bold">
                <span>{proj.title}</span>
                {proj.technologies && proj.technologies.length > 0 && (
                  <span className="font-normal italic text-gray-600">
                    ({proj.technologies.join(", ")})
                  </span>
                )}
              </div>
              {proj.description && <p className="text-gray-800 font-sans">{proj.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {data.education && data.education.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider border-b border-gray-400 pb-1">
            Education
          </h2>
          {data.education.map((edu, idx) => (
            <div key={idx} className="flex justify-between items-baseline text-xs">
              <div>
                <span className="font-bold">{edu.institution}</span> — {edu.degree}{" "}
                {edu.field ? `(${edu.field})` : ""}
                {edu.cgpa && <span className="text-gray-600"> | CGPA: {edu.cgpa}</span>}
              </div>
              <span className="font-sans text-gray-700">
                {edu.startYear} – {edu.endYear}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {data.skills && data.skills.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider border-b border-gray-400 pb-1">
            Skills
          </h2>
          <p className="text-xs font-sans text-gray-800">{data.skills.join(" • ")}</p>
        </div>
      )}

      {/* Certifications & Achievements */}
      {((data.certifications && data.certifications.length > 0) ||
        (data.achievements && data.achievements.length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {data.certifications && data.certifications.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider border-b border-gray-400 pb-1">
                Certifications
              </h2>
              <ul className="list-disc list-inside text-xs font-sans text-gray-800 space-y-1">
                {data.certifications.map((c, idx) => (
                  <li key={idx}>
                    {c.title} — {c.organization}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.achievements && data.achievements.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider border-b border-gray-400 pb-1">
                Achievements
              </h2>
              <ul className="list-disc list-inside text-xs font-sans text-gray-800 space-y-1">
                {data.achievements.map((ach, idx) => (
                  <li key={idx}>{ach}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* =========================================================
   TEMPLATE 3: MINIMALIST TEMPLATE
   ========================================================= */
const MinimalistTemplate: React.FC<{ data: ResumeData }> = ({ data }) => {
  return (
    <div className="p-8 sm:p-12 border-l-8 border-emerald-500 space-y-8 font-sans">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight">
          {data.name || "Your Name"}
        </h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-emerald-700">
          {data.email && <span>{data.email}</span>}
          {data.phone && <span>| {data.phone}</span>}
          {data.address && <span>| {data.address}</span>}
          {data.linkedin && <span>| LinkedIn</span>}
          {data.github && <span>| GitHub</span>}
        </div>
        {data.summary && (
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-2xl pt-2">
            {data.summary}
          </p>
        )}
      </div>

      {/* Experience */}
      {data.experience && data.experience.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">
            01 / Experience
          </h2>
          <div className="space-y-4">
            {data.experience.map((exp, idx) => (
              <div key={idx} className="space-y-1 border-l-2 border-gray-100 pl-4 text-xs">
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-gray-900">{exp.role}</span>
                  <span className="text-emerald-600 font-semibold">
                    {exp.startDate} — {exp.endDate}
                  </span>
                </div>
                <p className="text-gray-500 font-medium">{exp.company}</p>
                {exp.description && <p className="text-gray-600 pt-1">{exp.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {data.projects && data.projects.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">
            02 / Projects
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.projects.map((proj, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-100 text-xs space-y-1">
                <p className="font-bold text-gray-900">{proj.title}</p>
                {proj.technologies && (
                  <p className="text-emerald-600 text-[11px]">{proj.technologies.join(" • ")}</p>
                )}
                {proj.description && <p className="text-gray-600 text-[11px]">{proj.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {data.education && data.education.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">
            03 / Education
          </h2>
          <div className="space-y-3">
            {data.education.map((edu, idx) => (
              <div key={idx} className="flex justify-between items-baseline text-xs">
                <div>
                  <p className="font-bold text-gray-900">{edu.institution}</p>
                  <p className="text-gray-600">
                    {edu.degree} {edu.field ? `- ${edu.field}` : ""}
                  </p>
                </div>
                <span className="text-gray-500">
                  {edu.startYear} - {edu.endYear}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {data.skills && data.skills.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">
            04 / Skills
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.skills.map((skill, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumePreview;
