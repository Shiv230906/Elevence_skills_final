import axios from "axios";
import {
  ArrowUpRight,
  Calendar,
  Clock,
  DollarSign,
  Filter,
  Pin,
  PlayCircle,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { API_URL } from "@/config/api";

const index = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const queryQ = typeof router.query.q === "string" ? router.query.q : "";
  const [searchKeyword, setSearchKeyword] = useState("");

  useEffect(() => {
    if (queryQ) {
      setSearchKeyword(queryQ);
    }
  }, [queryQ]);

  const [filteredjob, setfilteredjobs] = useState<any>([]);
  const [isFiltervisible, setisFiltervisible] = useState(false);
  const [filter, setfilters] = useState({
    category: "",
    location: "",
    workFromHome: false,
    partTime: false,
    salary: 50,
    experience: "",
  });
  const [filteredJobs, setjob] = useState<any>([]);

  useEffect(() => {
    const fetchdata = async () => {
      try {
        let res;
        try {
          res = await axios.get(`${API_URL}/job`);
        } catch {
          res = await axios.get("https://elevance-skill.onrender.com/api/job");
        }
        setjob(res.data);
        setfilteredjobs(res.data);
      } catch (error) {
        console.log(error);
      }
    };
    fetchdata();
  }, []);

  useEffect(() => {
    const filtered = filteredJobs.filter((job: any) => {
      const matchesCategory = (job.category || "")
        .toLowerCase()
        .includes(filter.category.toLowerCase());
      const matchesLocation = (job.location || "")
        .toLowerCase()
        .includes(filter.location.toLowerCase());
      const matchesSearch = !searchKeyword.trim() || (
        (job.title || "").toLowerCase().includes(searchKeyword.toLowerCase()) ||
        (job.company || "").toLowerCase().includes(searchKeyword.toLowerCase()) ||
        (job.category || "").toLowerCase().includes(searchKeyword.toLowerCase()) ||
        (job.location || "").toLowerCase().includes(searchKeyword.toLowerCase())
      );
      return matchesCategory && matchesLocation && matchesSearch;
    });
    setfilteredjobs(filtered);
  }, [filter, filteredJobs, searchKeyword]);
  const handlefilterchange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setfilters((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };
  const clearFilters = () => {
    setfilters({
      category: "",
      location: "",
      workFromHome: false,
      partTime: false,
      salary: 50,
      experience: "",
    });
  };
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Filter  */}
          <div className="hidden md:block w-64 bg-white rounded-lg shadow-sm p-6 h-fit">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-black">{t("job.filter")}</span>
              </div>
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {t("job.clearAll")}
              </button>
            </div>
            <div className="space-y-6">
              {/* Profile/Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("job.category")}
                </label>
                <input
                  type="text"
                  name="category"
                  value={filter.category}
                  onChange={handlefilterchange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-700"
                  placeholder={t("job.categoryPlaceholder")}
                />
              </div>
              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("job.location")}
                </label>
                <input
                  type="text"
                  name="location"
                  value={filter.location}
                  onChange={handlefilterchange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-700"
                  placeholder={t("locationPlaceholder")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("job.experience")}
                </label>
                <input
                  type="text"
                  name="experience"
                  value={filter.experience}
                  onChange={handlefilterchange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-700"
                  placeholder={t("job.experience")}
                />
              </div>

              {/* Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="workFromHome"
                    checked={filter.workFromHome}
                    onChange={handlefilterchange}
                    className="h-4 w-4 text-blue-600 rounded "
                  />
                  <span className="text-gray-700">{t("job.workFromHome")}</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="partTime"
                    checked={filter.partTime}
                    onChange={handlefilterchange}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-gray-700">Part-time</span>
                </label>
              </div>

              {/* Stipend Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("job.salary")}
                </label>
                <input
                  type="range"
                  name="salary"
                  min="0"
                  max="100"
                  value={filter.salary}
                  onChange={handlefilterchange}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-600">
                  <span>₹0L</span>
                  <span>₹50L</span>
                  <span>₹100L</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="md:hidden mb-4">
              <button
                onClick={() => setisFiltervisible(!isFiltervisible)}
                className="w-full flex items-center justify-center space-x-2 bg-white p-3 rounded-lg shadow-sm text-black"
              >
                <Filter className="h-5 w-5" />
                <span> {t("job.showFilters")}</span>
              </button>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
              <p className="text-center font-medium text-black">
                {filteredjob.length} {t("job.jobsFound")}
              </p>
            </div>
            <div className="space-y-4">
              {filteredjob.map((job: any) => (
                <div
                  key={job._id}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center space-x-2 text-blue-600 mb-4">
                    <ArrowUpRight className="h-5 w-5" />
                    <span className="font-medium">{t("job.activelyHiring")}</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    {job.title}
                  </h2>
                  <p className="text-gray-600 mb-4">{job.company}</p>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <PlayCircle className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-medium">Category</p>
                        <p className="text-sm">{job.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Pin className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-medium">Location</p>
                        <p className="text-sm">{job.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-600">
                      <DollarSign className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-medium">CTC</p>
                        <p className="text-sm">{job.CTC}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                        {t("job.job")}
                      </span>
                      <div className="flex items-center space-x-1 text-green-600">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">{t("job.postedRecently")}</span>
                      </div>
                    </div>
                    <Link
                      href={`/detailjob/${job._id}`}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                     {t("job.viewDetails")}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Mobile Filters Modal */}
      {isFiltervisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden">
          <div className="bg-white h-full w-full max-w-sm ml-auto p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold">{t("job.filters")}</h2>
              <button
                onClick={() => setisFiltervisible(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-6">
              {/* Profile/Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("job.category")}
                </label>
                <input
                  type="text"
                  name="category"
                  value={filter.category}
                  onChange={handlefilterchange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-700"
                  placeholder="e.g. Marketing Intern"
                />
              </div>
              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("job.location")}
                </label>
                <input
                  type="text"
                  name="location"
                  value={filter.location}
                  onChange={handlefilterchange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-700"
                  placeholder="e.g. Mumbai"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("job.experience")}
                </label>
                <input
                  type="text"
                  name="experience"
                  value={filter.experience}
                  onChange={handlefilterchange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-700"
                  placeholder="e.g. Mumbai"
                />
              </div>
              {/* Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="workFromHome"
                    checked={filter.workFromHome}
                    onChange={handlefilterchange}
                    className="h-4 w-4 text-blue-600 rounded "
                  />
                  <span className="text-gray-700">Work from home</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="partTime"
                    checked={filter.partTime}
                    onChange={handlefilterchange}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-gray-700">Part-time</span>
                </label>
              </div>

              {/* Stipend Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("job.salary")}
                </label>
                <input
                  type="range"
                  name="salary"
                  min="0"
                  max="100"
                  value={filter.salary}
                  onChange={handlefilterchange}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-600">
                  <span>₹0L</span>
                  <span>₹50L</span>
                  <span>₹100L</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default index;