import axios from "axios";
import { Building2, Calendar, ExternalLink, FileText, Loader2, User } from "lucide-react";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";

const index = () => {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setloading] = useState(false);
  const [data, setdata] = useState<any>({});

  const getBackendUrl = (): string => {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  };

  useEffect(() => {
    const fetchdata = async () => {
      if (!id) return;
      try {
        setloading(true);
        const urls = [
          `${getBackendUrl()}/application/${id}`,
          `https://elevance-skill.onrender.com/api/application/${id}`,
          `https://internshala-clone-y2p2.onrender.com/api/application/${id}`,
        ];

        for (const url of urls) {
          try {
            const res = await axios.get(url);
            if (res.data) {
              setdata(res.data);
              break;
            }
          } catch {
            // fallback
          }
        }
      } catch (error) {
        console.log(error);
      } finally {
        setloading(false);
      }
    };
    fetchdata();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600 font-medium">
          Loading application details...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <section className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Image Section */}
            <div className="relative bg-gray-100 min-h-[300px] flex items-center justify-center">
              {data?.user?.photo ? (
                <img
                  alt="Applicant photo"
                  className="w-full h-full object-cover"
                  src={data.user.photo}
                />
              ) : (
                <User className="w-24 h-24 text-gray-400" />
              )}
              {data?.status && (
                <div
                  className={`absolute top-4 right-4 px-4 py-2 rounded-full shadow-md font-bold text-xs capitalize ${
                    data.status === "accepted" || data.status === "approved"
                      ? "bg-green-100 text-green-700"
                      : data.status === "rejected"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {data.status}
                </div>
              )}
            </div>

            {/* Content Section */}
            <div className="p-8 space-y-6">
              <div>
                <div className="flex items-center mb-2">
                  <Building2 className="w-5 h-5 text-blue-600 mr-2" />
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Company</h2>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {data?.company || "N/A"}
                </h1>
                {data?.category && (
                  <p className="text-xs font-medium text-blue-600 mt-1">
                    Category: {data.category}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <FileText className="w-5 h-5 text-blue-600 mr-2" />
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Cover Letter
                  </h2>
                </div>
                <p className="text-gray-600 leading-relaxed text-sm bg-gray-50 p-4 rounded-xl border border-gray-200">
                  {data?.coverLetter || "No cover letter provided."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-2">
                <div>
                  <div className="flex items-center mb-1">
                    <Calendar className="w-4 h-4 text-blue-600 mr-2" />
                    <span className="text-xs font-semibold text-gray-500 uppercase">
                      Application Date
                    </span>
                  </div>
                  <p className="text-gray-900 font-bold text-sm">
                    {data?.createdAt
                      ? new Date(data.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "N/A"}
                  </p>
                </div>

                <div>
                  <div className="flex items-center mb-1">
                    <User className="w-4 h-4 text-blue-600 mr-2" />
                    <span className="text-xs font-semibold text-gray-500 uppercase">
                      Applied By
                    </span>
                  </div>
                  <p className="text-gray-900 font-bold text-sm">
                    {data?.user?.name || "N/A"}
                  </p>
                  <p className="text-xs text-gray-500">{data?.user?.email}</p>
                </div>
              </div>

              {/* Attached Resume Action */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Attached Premium Resume
                </h3>
                {data?.resumeUrl ? (
                  <a
                    href={data.resumeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-colors"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View / Download PDF Resume
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                ) : (
                  <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg border border-gray-200">
                    No paid resume attached to this application.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default index;