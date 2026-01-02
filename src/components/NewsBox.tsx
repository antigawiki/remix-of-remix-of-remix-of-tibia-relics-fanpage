import { Calendar, User } from 'lucide-react';

interface NewsBoxProps {
  title: string;
  date: string;
  author: string;
  content: string;
  image?: string;
}

const NewsBox = ({ title, date, author, content, image }: NewsBoxProps) => {
  return (
    <article className="news-box animate-fade-in">
      <header className="news-box-header">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex items-center gap-3 text-xs opacity-80">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {date}
          </span>
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {author}
          </span>
        </div>
      </header>
      <div className="news-box-content">
        {image && (
          <img 
            src={image} 
            alt={title} 
            className="float-left mr-4 mb-2 w-24 h-24 object-cover rounded-sm border border-border"
          />
        )}
        <div 
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: content }}
        />
        <div className="clear-both" />
      </div>
    </article>
  );
};

export default NewsBox;
