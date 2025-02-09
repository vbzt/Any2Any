import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDownIcon } from "@radix-ui/react-icons";
import styles from './CustomDropdown.module.css';
import { useState } from 'react';

const extensions = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'svg', 'tga'],
  video: ['mp4', 'avi', 'mov', 'wmv', 'mkv', 'ogv', 'webm'],
  audio: ['mp3', 'wav', 'ogg', 'aac', 'flac'],
};

interface CustomDropdownProps {
  fileType: 'image' | 'video' | 'audio';
  onFormatSelect: (format: string) => void; // A função de callback
}

const CustomDropdown = ({ fileType, onFormatSelect }: CustomDropdownProps) => {
  const [selected, setSelected] = useState("");

  const fileExtensions = extensions[fileType];

  const handleSelect = (ext: string) => {
    setSelected(ext);
    onFormatSelect(ext); // Chama a função de callback para atualizar o estado no FileUpload
  };

  return (
    <section className={styles.dropdown}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className={styles.dropdownButton}>
          <span>{selected || `Select a format`}</span>
          <ChevronDownIcon />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className={styles.dropdownMenu}>
          <DropdownMenu.Item className={styles.dropdownItem} onClick={() => setSelected("")}>
            Clear selection
          </DropdownMenu.Item>
          <DropdownMenu.Separator className={styles.separator} />
          <div className={styles.dropdownColumns}>
            {fileExtensions.map((ext, index) => (
              <DropdownMenu.Item
                key={index}
                className={styles.dropdownItem}
                onClick={() => handleSelect(ext)}
              >
                {ext}
              </DropdownMenu.Item>
            ))}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </section>
  );
};

export default CustomDropdown;
