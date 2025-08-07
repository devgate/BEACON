import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolderOpen, faCog, faCalculator, faUtensils, faBook, faFileAlt } from '@fortawesome/free-solid-svg-icons';

const CategoryList = ({ categories, selectedCategoryId, onSelectCategory, onSettings, showSettings }) => {
  const totalDocs = categories.reduce((sum, cat) => sum + (cat.document_count || 0), 0);

  // 아이콘 매핑 함수
  const getIconComponent = (iconClass) => {
    const iconMap = {
      'fas fa-calculator': faCalculator,
      'fas fa-utensils': faUtensils,
      'fas fa-book': faBook,
      'fas fa-file-alt': faFileAlt
    };
    return iconMap[iconClass] || faFileAlt;
  };

  return (
    <div className="category-list">
      <div 
        className={`category-item ${selectedCategoryId === 'all' ? 'active' : ''}`}
        onClick={() => onSelectCategory(selectedCategoryId === 'all' ? null : 'all')}
      >
        <div className="category-main">
          <div className="category-icon" style={{ color: '#718096' }}>
            <FontAwesomeIcon icon={faFolderOpen} />
          </div>
          <div className="category-info">
            <div className="category-name">전체</div>
            <div className="category-description">모든 카테고리의 문서</div>
          </div>
          <div className="category-count">{totalDocs}</div>
        </div>
      </div>

      {categories.map(category => (
        <div 
          key={category.id}
          className={`category-item ${selectedCategoryId === category.id ? 'active' : ''}`}
        >
          <div 
            className="category-main"
            onClick={() => onSelectCategory(selectedCategoryId === category.id ? null : category.id)}
          >
            <div className="category-icon" style={{ color: category.color }}>
              <FontAwesomeIcon icon={getIconComponent(category.icon)} />
            </div>
            <div className="category-info">
              <div className="category-name">{category.name}</div>
              <div className="category-description">{category.description}</div>
            </div>
            <div className="category-count">{category.document_count || 0}</div>
          </div>
          {showSettings && (
            <div className="category-actions">
              <button 
                className="settings-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSettings(category);
                }}
                title="카테고리 설정"
              >
                <FontAwesomeIcon icon={faCog} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CategoryList;