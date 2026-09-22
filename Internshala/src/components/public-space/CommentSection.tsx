import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { selectuser } from "@/feature/userSlice";
import { useTranslation } from "react-i18next";
import { Send, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "react-toastify";

import { BACKEND_URL } from "@/config/api";

interface Comment {
  _id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  text: string;
  createdAt: string;
}

interface CommentSectionProps {
  postId: string;
  initialComments?: Comment[];
  isOpen: boolean;
  onToggle: () => void;
  onCommentCountChange?: (count: number) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  initialComments = [],
  isOpen,
  onToggle,
  onCommentCountChange,
}) => {
  const { t } = useTranslation();
  const user = useSelector(selectuser);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load comments when opened
  useEffect(() => {
    if (isOpen && !hasLoaded) {
      fetchComments();
    }
  }, [isOpen]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/posts/${postId}/comments`);
      const data = await res.json();
      if (data.success) {
        setComments(data.comments);
        setHasLoaded(true);
        onCommentCountChange?.(data.comments.length);
      }
    } catch (err) {
      console.error("[CommentSection] Error fetching comments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error(t("publicSpace.loginRequired"));
      return;
    }
    if (!commentText.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          userName: user.name,
          userPhoto: user.photo,
          text: commentText.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setComments((prev) => [...prev, data.comment]);
        setCommentText("");
        onCommentCountChange?.(comments.length + 1);
      } else {
        toast.error(data.error || t("publicSpace.commentFailed"));
      }
    } catch (err) {
      toast.error(t("publicSpace.commentFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/posts/${postId}/comments/${commentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setComments((prev) => prev.filter((c) => c._id !== commentId));
        toast.success(t("publicSpace.commentDeleted"));
        onCommentCountChange?.(comments.length - 1);
      } else {
        toast.error(data.error || t("publicSpace.deleteFailed"));
      }
    } catch (err) {
      toast.error(t("publicSpace.deleteFailed"));
    }
  };

  return (
    <div className="border-t border-gray-100">
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium">
          {comments.length > 0 ? `${comments.length} ${t("publicSpace.comments")}` : t("publicSpace.comment")}
        </span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4">
          {/* Comment Input */}
          {user && (
            <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-3">
              <img
                src={user.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || "U")}`}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-200"
              />
              <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t("publicSpace.writeComment")}
                  className="flex-1 bg-transparent text-sm text-gray-800 focus:outline-none placeholder-gray-400"
                  maxLength={1000}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !commentText.trim()}
                  className="text-blue-600 disabled:opacity-40 hover:text-blue-800 transition-colors flex-shrink-0"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </form>
          )}

          {/* Comments List */}
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">No comments yet.</p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment._id} className="flex items-start gap-2 group">
                  <img
                    src={comment.userPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.userName || "U")}`}
                    alt={comment.userName}
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-gray-200"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="bg-gray-100 rounded-2xl px-3 py-2 inline-block max-w-full">
                      <p className="text-xs font-semibold text-gray-800">{comment.userName || "Anonymous"}</p>
                      <p className="text-sm text-gray-700 break-words">{comment.text}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 ml-1">{timeAgo(comment.createdAt)}</p>
                  </div>
                  {/* Delete — only own comments */}
                  {user?.uid === comment.userId && (
                    <button
                      onClick={() => handleDelete(comment._id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 mt-1 flex-shrink-0"
                      title={t("publicSpace.deleteComment")}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
