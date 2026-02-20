import React from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-window-auto-sizer';

/**
 * Virtualized message list - Only renders visible messages
 * Handles 1000+ messages without lag
 */
export const VirtualizedMessageList = React.memo(({
  messages,
  renderMessage,
  containerHeight,
  messageHeight = 80 // Adjust based on your message component height
}) => {
  if (!messages || messages.length === 0) {
    return null;
  }

  const Row = ({ index, style }) => (
    <div style={style}>
      {renderMessage(messages[index], index)}
    </div>
  );

  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height || containerHeight}
          itemCount={messages.length}
          itemSize={messageHeight}
          width={width}
          overscanCount={5} // Render 5 messages outside viewport for smooth scrolling
        >
          {Row}
        </List>
      )}
    </AutoSizer>
  );
});

VirtualizedMessageList.displayName = 'VirtualizedMessageList';