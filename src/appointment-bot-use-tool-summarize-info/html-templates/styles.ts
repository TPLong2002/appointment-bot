/**
 * CSS styles cho chat UI
 */
export const chatStyles = `
<style>
.doctor-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  margin-bottom: 10px;
}
.doctor-card {
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 15px;
  width: calc(50% - 10px);
  cursor: pointer;
  transition: all 0.2s;
  background-color: #fff;
}
.doctor-card:hover {
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}
.doctor-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 15px;
  background-color: #0d6efd;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: bold;
}
.doctor-info {
  flex: 1;
}
.doctor-name {
  font-weight: bold;
  font-size: 16px;
  margin-bottom: 5px;
}
.doctor-specialty {
  color: #666;
  font-size: 14px;
  margin-bottom: 5px;
}
.doctor-experience {
  color: #888;
  font-size: 12px;
}
.date-selection {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  margin-bottom: 10px;
}
.date-button {
  padding: 8px 15px;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s;
}
.date-button:hover {
  background-color: #f0f0f0;
}
.time-selection {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  margin-bottom: 10px;
}
.time-button {
  padding: 8px 15px;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s;
}
.time-button:hover {
  background-color: #f0f0f0;
}
</style>
`;
