import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { selectuser } from "@/feature/userSlice";
import { useTranslation } from "react-i18next";
import { Users, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import PostComposer from "@/components/public-space/PostComposer";
import PostCard from "@/components/public-space/PostCard";
import Head from "next/head";

import { BACKEND_URL } from "@/config/api";

interface Post {
  _id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  userEmail: string;
  content: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  likes: string[];
  comments: any[];
  shares: number;
  createdAt: string;
}

interface PostPermission {
  canPost: boolean;
  unlimited: boolean;
  remaining: number | string;
  dailyLimit: number | string;
  todayCount: number;
  friendCount: number;
}

const PublicSpacePage = () => {
  const { t } = useTranslation();
  const user = useSelector(selectuser);
  const [posts, setPosts] = useState<Post[]>([]);
  const [permission, setPermission] = useState<PostPermission | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "mine">("all");

  const fetchPermission = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/posts/permission/${user.uid}`);
      const data = await res.json();
      if (data.success) {
        setPermission({
          canPost: data.canPost,
          unlimited: data.unlimited,
          remaining: data.remaining,
          dailyLimit: data.dailyLimit,
          todayCount: data.todayCount,
          friendCount: data.friendCount,
        });
      }
    } catch (err) {
      console.warn("[PublicSpace] Could not fetch permission:", err);
    }
  }, [user?.uid]);

  const fetchPosts = useCallback(async (pageNum = 1, tab = activeTab, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const userId = tab === "mine" && user?.uid ? `&userId=${user.uid}` : "";
      const res = await fetch(`${BACKEND_URL}/api/posts?page=${pageNum}&limit=20${userId}`);
      const data = await res.json();

      if (data.success) {
        if (append) {
          setPosts((prev) => [...prev, ...data.posts]);
        } else {
          setPosts(data.posts);
        }
        setHasMore(data.pagination.hasMore);
      }
    } catch (err) {
      console.error("[PublicSpace] Error fetching posts:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeTab, user?.uid]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchPosts(1, activeTab, false);
  }, [activeTab]);

  useEffect(() => {
    if (user?.uid) {
      fetchPermission();
    }
  }, [user?.uid]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, activeTab, true);
  };

  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
    fetchPermission(); // Refresh permission after posting
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p._id !== postId));
    fetchPermission();
  };

  return (
    <>
      <Head>
        <title>{t("publicSpace.title")} — InternArea</title>
        <meta name="description" content="Share your thoughts, experiences and connect with others on InternArea Public Space." />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t("publicSpace.title")}</h1>
              <p className="text-sm text-gray-500 mt-0.5">Share your thoughts with the community</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/friends"
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <Users size={16} />
                {t("friends.title")}
              </Link>
              <button
                onClick={() => fetchPosts(1, activeTab, false)}
                className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
                title="Refresh"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {/* Login prompt for guests */}
          {!user && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users size={22} className="text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Join the conversation</h3>
              <p className="text-sm text-gray-500 mb-4">{t("publicSpace.loginRequired")}</p>
            </div>
          )}

          {/* Post Composer (only for logged in users) */}
          {user && (
            <PostComposer
              permission={permission}
              onPostCreated={handlePostCreated}
            />
          )}

          {/* Tab Bar */}
          <div className="flex rounded-xl bg-white border border-gray-100 shadow-sm mb-5 p-1 gap-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              All Posts
            </button>
            {user && (
              <button
                onClick={() => setActiveTab("mine")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "mine"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                My Posts
              </button>
            )}
          </div>

          {/* Posts Feed */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Loader2 size={32} className="animate-spin mb-3" />
              <p className="text-sm">{t("publicSpace.loading")}</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-700 mb-1">
                {activeTab === "mine" ? t("publicSpace.noPostsUser") : t("publicSpace.noPosts")}
              </h3>
              {activeTab === "mine" && user && (
                <p className="text-sm text-gray-400">Your posts will appear here.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post._id}
                  post={post}
                  onDeleted={handlePostDeleted}
                />
              ))}

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load more"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PublicSpacePage;
