import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { selectuser } from "@/feature/userSlice";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import { Heart, Share2, Copy, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import Link from "next/link";
import Head from "next/head";
import CommentSection from "@/components/public-space/CommentSection";

import { BACKEND_URL } from "@/config/api";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const PostDetailPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = router.query;
  const user = useSelector(selectuser);

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState<string[]>([]);
  const [shares, setShares] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(true);

  const postUrl = typeof window !== "undefined" ? window.location.href : "";
  const isLiked = user?.uid ? likes.includes(user.uid) : false;
  const isOwner = user?.uid === post?.userId;

  useEffect(() => {
    if (!id) return;
    const fetchPost = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/posts/${id}`);
        const data = await res.json();
        if (data.success) {
          setPost(data.post);
          setLikes(data.post.likes || []);
          setShares(data.post.shares || 0);
        } else {
          toast.error("Post not found.");
        }
      } catch (err) {
        toast.error("Unable to load post.");
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id]);

  const handleLike = async () => {
    if (!user) { toast.error(t("publicSpace.loginRequired")); return; }
    if (likeLoading) return;
    setLikeLoading(true);
    const wasLiked = likes.includes(user.uid!);
    setLikes((prev) => wasLiked ? prev.filter((uid) => uid !== user.uid) : [...prev, user.uid!]);
    try {
      const res = await fetch(`${BACKEND_URL}/api/posts/${id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json();
      if (res.ok) { setLikes(data.likes); }
      else {
        setLikes((prev) => wasLiked ? [...prev, user.uid!] : prev.filter((uid) => uid !== user.uid));
        toast.error(t("publicSpace.likeFailed"));
      }
    } catch {
      setLikes((prev) => wasLiked ? [...prev, user.uid!] : prev.filter((uid) => uid !== user.uid));
      toast.error(t("publicSpace.likeFailed"));
    } finally { setLikeLoading(false); }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Post by ${post?.userName}`, text: post?.content, url: postUrl });
      } else {
        await navigator.clipboard.writeText(postUrl);
        toast.success(t("publicSpace.linkCopied"));
      }
      const res = await fetch(`${BACKEND_URL}/api/posts/${id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.uid }),
      });
      const data = await res.json();
      if (res.ok) setShares(data.shares);
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        await navigator.clipboard.writeText(postUrl).catch(() => {});
        toast.success(t("publicSpace.linkCopied"));
      }
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("publicSpace.confirmDelete"))) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/posts/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.uid }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t("publicSpace.postDeleted"));
        router.push("/public-space");
      } else {
        toast.error(data.error || t("publicSpace.deleteFailed"));
      }
    } catch {
      toast.error(t("publicSpace.deleteFailed"));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Post not found.</p>
        <Link href="/public-space" className="text-blue-600 hover:underline text-sm">
          ← Back to Public Space
        </Link>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{post.userName}'s post — InternArea Public Space</title>
        <meta name="description" content={post.content?.slice(0, 160) || "View this post on InternArea Public Space"} />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Back */}
          <Link
            href="/public-space"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 mb-5 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Public Space
          </Link>

          {/* Post Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Author */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src={post.userPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.userName || "U")}`}
                  alt={post.userName}
                  className="w-12 h-12 rounded-full object-cover border border-gray-200"
                />
                <div>
                  <p className="font-semibold text-gray-900">{post.userName || "Anonymous"}</p>
                  <p className="text-xs text-gray-400">{timeAgo(post.createdAt)}</p>
                </div>
              </div>
              {isOwner && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                  {t("publicSpace.deletePost")}
                </button>
              )}
            </div>

            {/* Content */}
            {post.content && (
              <div className="px-5 pb-4">
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>
              </div>
            )}

            {/* Media */}
            {post.mediaUrl && (
              <div className="px-5 pb-4">
                {post.mediaType === "image" ? (
                  <img
                    src={post.mediaUrl}
                    alt="Post media"
                    className="w-full rounded-xl object-cover bg-gray-100"
                  />
                ) : post.mediaType === "video" ? (
                  <video src={post.mediaUrl} controls className="w-full rounded-xl" />
                ) : null}
              </div>
            )}

            {/* Stats */}
            <div className="px-5 py-2 flex items-center justify-between text-sm text-gray-400 border-t border-gray-50">
              <span>{likes.length} {likes.length === 1 ? "like" : "likes"}</span>
              <span>{shares} {shares === 1 ? "share" : "shares"}</span>
            </div>

            {/* Actions */}
            <div className="px-5 pb-3 flex items-center gap-1 border-t border-gray-100">
              <button
                onClick={handleLike}
                disabled={likeLoading}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isLiked ? "text-red-500 bg-red-50" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Heart size={17} className={isLiked ? "fill-red-500" : ""} />
                {isLiked ? t("publicSpace.liked") : t("publicSpace.like")}
              </button>
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Share2 size={17} />
                {t("publicSpace.share")}
              </button>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(postUrl).catch(() => {});
                  toast.success(t("publicSpace.linkCopied"));
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Copy size={17} />
                {t("publicSpace.copyLink")}
              </button>
            </div>

            {/* Comments */}
            <CommentSection
              postId={post._id}
              initialComments={post.comments || []}
              isOpen={commentsOpen}
              onToggle={() => setCommentsOpen((prev) => !prev)}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default PostDetailPage;
