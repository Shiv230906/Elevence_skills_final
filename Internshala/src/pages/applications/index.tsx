import axios from "axios";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Mail,
  Tag,
  User,
  XCircle,
  FileText,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { API_URL } from "@/config/api";

const getStatusColor = (status: any) => {
  if (!status) return "bg-yellow-100 text-yellow-800";
  switch (status.toLowerCase()) {
    case "approved":
    case "accepted":
      return "bg-green-100 text-green-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    default:
      return "bg-yellow-100 text-yellow-800";
  }
};

const Applications = () => {
  const [searchTerm, setsearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [data, setdata] = useState<any>([]);

  useEffect(() => {
    const fetchdata = async () => {
      const urls = [
        `${API_URL}/application`,
        "https://elevance-skill.onrender.com/api/application",
      ];
      for (const url of urls) {
        try {
          const res = await axios.get(url);
          if (res.data) {
            setdata(res.data);
            break;
          }
        } catch (err) {
          // fallback
        }
      }
    };
    fetchdata();
  }, []);

  const filteredapplications = data.filter((application: any) => {
    const searchmatch =
      application.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      application.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      application.user?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    if (filter === "all") return searchmatch;
    return searchmatch && application.status?.toLowerCase() === filter;
  });

  const handleacceptandreject = async (id: any, action: any) => {
    try {
      let res;
      const urls = [
        `${API_URL}/application/${id}`,
        `https://elevance-skill.onrender.com/api/application/${id}`,
      ];
      for (const url of urls) {
        try {
          res = await axios.put(url, { action });
          if (res.data) break;
        } catch {
          // fallback
        }
      }

      if (res?.data) {
        const updateappliacrtion = data.map((app: any) =>
          app._id === id ? res.data.data : app
        );
        setdata(updateappliacrtion);
        toast.success("Application status updated successfully");
      }
    } catch (error) {
      console.log(error);
      toast.error("Error updating application status");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Recruiter Applications Panel</h1>
            <p className="mt-1 text-sm text-gray-500">
              Review applicant details, attached resumes, and manage hiring decisions
            </p>
          </div>

          {/* Filters and Search */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex-1 w-full">
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setsearchTerm(e.target.value)}
                    placeholder="Search by company, category, or applicant..."
                    className="text-black w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <Mail className="absolute top-2.5 left-3 text-gray-400 w-4 h-4" />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                    filter === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("pending")}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                    filter === "pending" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setFilter("accepted")}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                    filter === "accepted" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Accepted
                </button>
                <button
                  onClick={() => setFilter("rejected")}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                    filter === "rejected" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Rejected
                </button>
              </div>
            </div>
          </div>

          {/* Applications List */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company & Category
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Applicant
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Applied Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions & Resume
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredapplications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                      No applications found.
                    </td>
                  </tr>
                ) : (
                  filteredapplications.map((application: any) => (
                    <tr key={application._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-blue-50 rounded-full border border-blue-100">
                            <Building2 className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-bold text-gray-900">{application.company}</div>
                            <div className="flex items-center text-xs text-gray-500 mt-0.5">
                              <Tag className="h-3.5 w-3.5 mr-1 text-gray-400" />
                              {application.category}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-full border border-gray-200">
                            <User className="h-5 w-5 text-gray-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-bold text-gray-900">{application.user?.name || "N/A"}</div>
                            <div className="text-xs text-gray-500">{application.user?.email || "N/A"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-xs text-gray-500 font-medium">
                          <Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                          {application.createdAt ? new Date(application.createdAt).toISOString().split("T")[0] : "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full capitalize ${getStatusColor(
                            application.status
                          )}`}
                        >
                          {application.status || "pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-3">
                          <Link
                            href={`/detailapplication?id=${application._id}`}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-900"
                          >
                            Details
                          </Link>

                          {/* View Resume Button */}
                          {application.resumeUrl ? (
                            <a
                              href={application.resumeUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold shadow-sm transition-colors"
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              View Resume
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No Resume</span>
                          )}

                          <button
                            onClick={() => handleacceptandreject(application._id, "accepted")}
                            className="text-green-600 hover:text-green-800 p-1"
                            title="Accept Application"
                          >
                            <CheckCircle2 className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleacceptandreject(application._id, "rejected")}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Reject Application"
                          >
                            <XCircle className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Applications;